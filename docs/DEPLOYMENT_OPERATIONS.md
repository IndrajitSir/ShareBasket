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

## Environment contract
API (`apps/api/.env.example`):
- `PORT` (default 4000), `NODE_ENV`.
- `DB_DRIVER` = `postgres` for deployment; `sqlite` for local development/tests.
- `DATABASE_URL` = `postgres://user:password@host:5432/database` (required when `DB_DRIVER=postgres`; `DATABASE_SSL=true` for most managed providers).
- `SQLITE_PATH` (default `./data/sharebasket.sqlite`) when `DB_DRIVER=sqlite`.
- `CORS_ORIGINS` = comma-separated browser origins, e.g. `http://localhost:3000,https://your-app.vercel.app`. Wildcards are not supported and must not be combined with credentials.
- `SEED_ON_BOOT=true` for a demo environment only; production data must be seeded intentionally with `npm run seed -w apps/api`.

Web (`apps/web/.env.example`):
- `API_URL` = server-side base URL of the API, e.g. `http://api:4000/api/v1` in compose or `https://your-api.onrender.com/api/v1`.
- `NEXT_PUBLIC_API_URL` = browser-visible API base URL with the same value in cloud deployments. Only non-secret values belong in `NEXT_PUBLIC_*`.

Secrets are set in the hosting dashboards (Vercel env vars, Render env vars). Never commit `.env`, `.env.local`, or real credentials.

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
