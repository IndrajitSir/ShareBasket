# ShareBasket — community group buying

A community bulk-buying marketplace for residential societies. Neighbours pool
demand for everyday essentials, see every quantity price tier up front, and
track progress toward each group minimum.

The product specification lives in [`docs/`](docs/README.md); start with
[`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/TODO.md`](docs/TODO.md).

## Repository layout

```
apps/web    Next.js 15 App Router storefront (TypeScript, Tailwind v4)
apps/api    NestJS REST API at /api/v1 (TypeScript, TypeORM)
infra       Dockerfiles, docker-compose.yml, deployment config
docs        product, architecture, data, security and workflow docs
```

The two apps are independent npm workspaces. The web app never imports backend
source; it talks to the API over JSON described in
[`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md).

## What works today

- **Campaign discovery** at `/campaigns`: filter by community and category,
  search campaigns, sort by closing date or progress, current tier price per
  campaign.
- **Campaign detail** at `/campaigns/[slug]`: all tiers, current tier, progress
  against the group minimum, deadline, delivery date, and a quantity calculator
  that asks the API to price the line server-side.
- **Catalogue** at `/shop` and `/product/[slug]`, backed by the API, with a
  search bar in the header and on listing pages.
- **Accounts** at `/login`, `/register` and `/account`: email/password with
  bcrypt, Google/GitHub OAuth when configured, and an HttpOnly JWT session kept
  first-party through a same-origin proxy. Services are defined in
  `apps/api/src/auth`.
- **Persisted sample data**: categories, products, societies, campaigns, price
  tiers and accounts are stored with TypeORM and served by NestJS.
- **Health check** at `/api/v1/health` reporting database connectivity.

## What is deliberately not live

There are no society memberships, roles, commitments, orders, stock reservations,
payments or verified suppliers. Accounts exist, but email verification, password
reset, MFA and login rate limiting do not. The bag and checkout are a preview:
checkout explains that ordering is not enabled and creates no order. Nothing here
should be presented as a real offer, real saving, or real order.

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
npm run dev -w apps/web          # http://localhost:3000
```

Root helpers: `npm run typecheck`, `npm run test`, `npm run build`, and
`npm run seed`.

To exercise the PostgreSQL target locally, use
`docker compose -f infra/docker-compose.yml up db` and set
`DB_DRIVER=postgres` plus `DATABASE_URL` in `apps/api/.env`.

OAuth is optional. Set `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and/or
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` in `apps/api/.env`, with
`PUBLIC_WEB_URL=http://localhost:3000`. The callback URLs are
`http://localhost:3000/api/backend/auth/google/callback` and
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
