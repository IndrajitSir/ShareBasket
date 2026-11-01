ShareBasket

Community bulk-buying marketplace.

## Repository layout

- `apps/api` — NestJS backend
- `apps/web` — Next.js frontend
- `infra` — Dockerfiles and Compose
- `docs` — project documentation and decision records

Quick orientation:
- install from the repository root with the project's package manager
- verify with the commands in `docs/TESTING.md`
- develop in small, independently tested units and commit each one
- do not treat the project as deployment-ready until the relevant checks in
  `docs/TODO.md` are completed and recorded

Current state:
- accounts, session auth, OAuth wiring, login/register/account pages and the
  same-origin auth proxy are in place
- society membership with scoped `MEMBER`/`STEWARD` roles, steward approval,
  and an append-only audit trail is in place
- residence verification (`P1-01f`) is in place as a per-society, member-declared,
  steward-reviewed lifecycle
- the explainability slice (`/for-you`, consented nearby groups) is in place
- email notifications, invitations, stale-claim expiry, duplicate-claim disputes,
  real OAuth consent smoke tests, CI, and a Vergel/Ren execution remain open

Do not self-declare production readiness. Human acceptance is required.
## Run it locally

Requires Node.js 20+.

```bash
npm install

# API (SQLite by default, no database server needed)
cp apps/api/.env.example apps/api/.env
npm run migration:run -w apps/api
npm run seed -w apps/api
npm run dev -w apps/api          # http://localhost:4000/api/v1

# Web (separate terminal)
cp apps/web/.env.example apps/web/.env.local
npm run dev -w apps/web          # http://localhost:3001
```

Root helpers: `npm run typecheck`, `npm run test`, `npm run build`, and
`npm run seed`.

To exercise the PostgreSQL target locally, use
`docker compose -f infra/docker-compose.yml up db` and set
`DB_DRIVER=postgres` plus `DATABASE_URL` in `apps/api/.env`.

OAuth is optional. Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` in `apps/api/.env`, with
`PUBLIC_WEB_URL=http://localhost:3001`. The callback URLs are
`http://localhost:3001/api/backend/auth/google/callback` and
`.../github/callback`. Without keys, only email/password sign-in is shown.
Production requires a 32+ character `AUTH_SECRET`.

## Verification commands

```bash
npm run typecheck        # both apps
npm run test             # API unit + integration tests (SQLite)
npm run build            # API compile and Next.js production build
```

## Deploy

- **Frontend** → Vercel, root directory `apps/web`, with `API_URL` and
  `NEXT_PUBLIC_API_URL` pointing at the API.
- **Backend** → Render Web Service built from `infra/api.Dockerfile`, with a
  managed PostgreSQL `DATABASE_URL`, `AUTH_SECRET`, `PUBLIC_WEB_URL` and
  `CORS_ORIGINS` set for the web origin. [`render.yaml`](render.yaml) provisions
  the API and database as a Blueprint; add OAuth keys in the Render dashboard.
- **Containers** → `docker compose -f infra/docker-compose.yml up --build`.

`docker compose -f infra/docker-compose.yml config` is verified. The images were
not built here because the Docker daemon socket is inaccessible, so run the build
commands on a machine with Docker before relying on them.

Full environment variables, migration steps and free-tier caveats are in
[`docs/DEPLOYMENT_OPERATIONS.md`](docs/DEPLOYMENT_OPERATIONS.md). Never commit
real secrets; only `.env.example` placeholders belong in the repository.
