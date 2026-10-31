# Deployment and Operations
Maintain local, CI/test, staging and production environments. Do not copy production data into dev without approved anonymisation.

## Deployable topology
Two independent images are built from `infra/` and published separately:

| Component | Local | Free cloud target | Build context |
| --- | --- | --- | --- |
| `apps/web` (Next.js) | `npm run dev -w apps/web` on port 3000 | Vercel, project root directory `apps/web` | `infra/web.Dockerfile` |
| `apps/api` (NestJS) | `npm run dev -w apps/api` on port 4000 | Render Web Service (Docker) | `infra/api.Dockerfile` |
| PostgreSQL | `infra/docker-compose.yml` service `db` | Render PostgreSQL or Neon free tier | image `postgres:16-alpine` |

Neither image depends on the other at build time; they only share the environment contract below. Build images from the repository root so the npm workspace files are in scope:

```bash
docker build -f infra/api.Dockerfile -t sharebasket-api .
docker build -f infra/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 -t sharebasket-web .
docker compose -f infra/docker-compose.yml up --build
```

## Verification status
`docker compose -f infra/docker-compose.yml config` was run and exited 0, so the topology parses. The images were **not built** and the stack was **not started** in the development environment used for this change: the Docker daemon socket returned permission denied. PostgreSQL migrations/seeds were exercised only on SQLite. Render and Vercel were not deployed. Treat the Dockerfiles and blueprints as reviewed but unproven until the build, PostgreSQL and cloud smoke checks in `TODO.md` (P0-16, P0-18) pass.

## Free-tier caveats
- Render free web services sleep after inactivity, so the first request after idle is slow; health checks may wake the service.
- Render's free PostgreSQL offer and retention windows change; confirm the current plan limits before relying on it. A free database may expire and lose data.
- Vercel preview deployments use unique hostnames. Browser requests from each preview origin must be added to `CORS_ORIGINS`, or routed through a same-origin proxy, before browser-side quote calls work.
- `NEXT_PUBLIC_API_URL` is baked into the browser bundle at build time; changing the API origin requires a rebuild/redeploy of the web app.

## Deployment options
All three targets run the **same two images** and the same NestJS recommendation code; there is no model server to provision.

| Target | Web | API | Database | Notes |
| --- | --- | --- | --- | --- |
| Vercel + Render | Vercel (`apps/web`) | Render Docker (`infra/api.Dockerfile`) | Render PostgreSQL or Neon | Free-tier path; current blueprint. |
| AWS | Vercel/Amplify, or the web image on ECS/App Runner | ECS Fargate or App Runner from `infra/api.Dockerfile` | RDS PostgreSQL | Migrations as a one-off ECS task/App Runner job; set secrets via Secrets Manager. |
| Virtual machine | `web` compose service behind Nginx/Caddy TLS | `api` compose service | `db` compose service with a named volume | Simplest single-host path; back up the volume and restrict the database port. |

For AWS and a VM, set the same environment contract below plus `PUBLIC_WEB_URL` to the public HTTPS web origin and `CORS_ORIGINS` to the same origin. Run `npm run migration:run -w apps/api` once per release before starting new API tasks. Both images are stateless except for the database, so horizontal API replicas are safe.

Browser geolocation only works on `https://` origins or `localhost`. A plain-HTTP VM deployment must terminate TLS (Caddy/Nginx/ALB) or the nearby-groups button will be blocked by the browser.

For a VM:

```bash
# .env values are read by compose; set AUTH_SECRET, PUBLIC_WEB_URL and CORS_ORIGINS first.
docker compose -f infra/docker-compose.yml up --build -d
# One-off schema + sample data (demo); production should run migrations only.
docker compose -f infra/docker-compose.yml exec api npm run migration:run
```

The recommendation engine needs no extra dependency beyond PostgreSQL; society coordinates live in `society_master`. If recommendation load grows, add a scheduled precompute job rather than a separate ML cluster.

## Environment contract
API (`apps/api/.env.example`):
- `PORT` (default 4000), `NODE_ENV`.
- `DB_DRIVER` = `postgres` for deployment; `sqlite` for local development/tests.
- `DATABASE_URL` = `postgres://user:password@host:5432/database` (required when `DB_DRIVER=postgres`; `DATABASE_SSL=true` for most managed providers).
- `SQLITE_PATH` (default `./data/sharebasket.sqlite`) when `DB_DRIVER=sqlite`.
- `CORS_ORIGINS` = comma-separated browser origins, e.g. `http://localhost:3000,https://your-app.vercel.app`. Wildcards are not supported and must not be combined with credentials.
- `SEED_ON_BOOT=true` for a demo environment only; production data must be seeded intentionally with `npm run seed -w apps/api`.
- `AUTH_SECRET` — at least 32 random characters used to sign session JWTs. **Required in production**; the API refuses to start without it. Generate with `openssl rand -base64 48` and store it only in the hosting dashboard.
- `SIGNAL_RATE_LIMIT_PER_MINUTE` — implicit quote signals accepted per member per minute (default 30, integer 0–10000; `0` disables). Counters are per API instance, so set it deliberately when scaling replicas.
- `PUBLIC_WEB_URL` — the browser origin of the web app, e.g. `http://localhost:3000` or `https://your-app.vercel.app`. Used for OAuth redirect URIs and post-login redirects. No trailing path.
- `SESSION_COOKIE_SECURE` — defaults to `true` when `NODE_ENV=production`. Set `false` only for a plain-HTTP local compose demo; HTTPS deployments must leave it secure.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional pair; both must be set or both omitted.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — optional pair; both must be set or both omitted.

Web (`apps/web/.env.example`):
- `API_URL` = server-side base URL of the API, e.g. `http://api:4000/api/v1` in compose or `https://your-api.onrender.com/api/v1`.
- `NEXT_PUBLIC_API_URL` = browser-visible API base URL with the same value in cloud deployments. Only non-secret values belong in `NEXT_PUBLIC_*`.

Secrets are set in the hosting dashboards (Vercel env vars, Render env vars). Never commit `.env`, `.env.local`, or real credentials.

## OAuth application setup
Create the apps only after the deployed web URL is known, because the redirect URI must match exactly:

- Google (Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application): authorised redirect URI `https://<web-origin>/api/backend/auth/google/callback` (locally `http://localhost:3000/api/backend/auth/google/callback`).
- GitHub (Settings → Developer settings → OAuth Apps): authorization callback URL `https://<web-origin>/api/backend/auth/github/callback`.

Put the client ID/secret pairs in the **API** service environment, set `PUBLIC_WEB_URL` to the web origin, and redeploy the API. The login page hides a provider when its pair is absent; credentials login works without OAuth. Vercel previews have unique hostnames and therefore need their own OAuth apps/callbacks or a fixed preview domain before OAuth can be tested there.

## Local setup
1. `npm install` at the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env` (SQLite default) and `apps/web/.env.example` to `apps/web/.env.local`.
3. `npm run migration:run -w apps/api`, then `npm run seed -w apps/api`.
4. `npm run dev -w apps/api` and `npm run dev -w apps/web` in separate terminals.

For the PostgreSQL path use `docker compose -f infra/docker-compose.yml up db` then run the same migration/seed commands with `DB_DRIVER=postgres` and a local `DATABASE_URL`.

## Render backend
1. Create a Render PostgreSQL instance and copy its internal connection string, or import the included `render.yaml` blueprint, which provisions the database and the Docker web service together.
2. Create (or let the blueprint create) a Web Service from this repository with **Docker** runtime, Dockerfile path `infra/api.Dockerfile`, no build command, and health check path `/api/v1/health`.
3. Set `DB_DRIVER=postgres`, `DATABASE_URL`, `DATABASE_SSL=true`, `CORS_ORIGINS` and (server-side only) any future provider keys. Keep secrets in the Render dashboard, never in `render.yaml`.
4. For a demo, the blueprint sets `MIGRATE_ON_BOOT`, `SEED_ON_BOOT` and `SEED_ALLOW_PRODUCTION` so the schema and synthetic sample data exist immediately. For any environment holding real data, remove those flags and run `npm run migration:run -w apps/api` once as a Render job/shell before the first traffic; the server does not migrate by default.

## Vercel frontend
1. Import the repository as a Vercel project and set the root directory to `apps/web`; the Next.js preset detects the workspace build.
2. Set `API_URL` and `NEXT_PUBLIC_API_URL` to the Render API URL including `/api/v1`.
3. Add the Vercel production and preview domains to the API's `CORS_ORIGINS` before relying on browser-side requests.
4. Preview deployments each get a unique hostname; either add the preview domain pattern explicitly or route browser requests through a same-origin proxy before launch.

## Configuration/local setup
`.env.example` contains descriptions and fake placeholders only. Validate required env at startup. Separate sandbox/live provider credentials. Never commit `.env`, credentials, signing keys or private dumps. Provide Docker Compose for PostgreSQL/Redis if used, and document install/migrate/seed/run/test/reset commands. Seeds are synthetic; demo payment mode is clearly labelled. Destructive reset scripts must refuse non-local environments.

## CI/CD
Formatting/lint → typecheck → tests → build → dependency/secret scan → migration validation → staging deploy → smoke tests → production approval. Use rollback-capable deployment and backward-compatible schema migrations.

## Observability
Structured logs with correlation IDs; metrics for latency/errors, DB pool, queue lag, campaign conversion, payment outcomes and delivery delays; tracing where feasible. Alert on 5xx, webhook failures, queue backlog, backup failures, order/stock mismatches and suspicious admin activity. Redact PII/secrets.

## Recovery/runbooks
Encrypted backups and point-in-time recovery where available. Define RPO/RTO before launch and test restore regularly. Document payment-provider outage, database outage, queue backlog, compromised account, leaked secret, privacy request, supplier suspension, campaign cancellation and failed delivery.
