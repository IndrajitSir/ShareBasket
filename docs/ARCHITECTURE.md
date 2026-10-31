# Architecture
Use a modular monolith with clean boundaries; extract services only when measured needs justify it.

## Repository layout
This repository is an npm-workspaces monorepo. The frontend and backend are independently buildable and independently deployable.

```
apps/web      Next.js App Router frontend (Vercel target)
apps/api      NestJS REST API (Render or any container target)
infra         Dockerfiles and docker-compose.yml for web, api and PostgreSQL
docs          product, architecture, data, security and workflow documentation
```

- Frontend routes live under `apps/web/app`; shared presentational components under `apps/web/components`; the typed API client and cart state under `apps/web/lib`.
- Backend modules live under `apps/api/src/<module>` with controller, DTOs, service and entities together. Cross-cutting concerns (request IDs, exception shape, validation) live in `apps/api/src/common`.
- The frontend never imports backend source. The contract is HTTP JSON, described in `API_CONTRACTS.md`.
- Each app owns its own `package.json`, `tsconfig.json`, `.env.example` and Dockerfile stage. Root scripts only orchestrate them.

## Current implementation state
The workspace contains a read-only catalogue and campaign preview API, email/password accounts with Google and GitHub OAuth, and the storefront that consumes them. There is no order, payment, inventory or commitment write path yet; those modules must be added as separate vertical slices with authorization, transactions and idempotency before any real buyer or supplier data is stored.

## Authentication and session flow
The NestJS API is the identity authority. Email/password credentials are hashed with bcrypt and OAuth Authorization Code flows run server-side; provider tokens and the session JWT never reach client JavaScript.

```
Browser → Next.js /api/backend/auth/* (same-origin proxy) → NestJS /api/v1/auth/*
                                                              ├── bcrypt credentials
                                                              ├── Google / GitHub token exchange
                                                              └── HttpOnly sb_session cookie
```

The proxy exists because Vercel and Render are different sites in the free deployment: a cookie set directly by the Render API would be third-party and blocked by many browsers. The proxy forwards the request body, `cookie`, `content-type` and safe response headers, including `Set-Cookie`; the browser stores `sb_session` as a first-party cookie on the web origin. The OAuth redirect URI is therefore `${PUBLIC_WEB_URL}/api/backend/auth/{provider}/callback`, not an API URL. The API redirects back to `${PUBLIC_WEB_URL}/account` after a successful exchange.

OAuth `state` is a random value stored in a short-lived HttpOnly `sb_oauth_state` cookie and compared on callback. Sessions are stateless JWTs with a 7-day lifetime, so logout clears the cookie but does not revoke a copied token; rate limiting, verification and revocation are tracked in `TODO.md`. All future protected API operations must check authorization on the server even though the UI hides controls.

## Recommendations
A dedicated `recommendations` module scores campaigns in-process using a pure engine (`recommendation-engine.ts`) over TypeORM reads: society memberships, quote signals, campaign demand and society coordinates. `POST /recommendations/nearby` performs Haversine distance from browser-consented coordinates and never persists them. There is no separate ML service, model server or GPU; the same API container runs on Render, AWS (ECS/App Runner) and a VM. See `RECOMMENDATIONS.md` for the algorithm, privacy rules and the precomputation path at scale.

## Stack
Next.js App Router + TypeScript; NestJS + TypeScript REST API at `/api/v1`; PostgreSQL; one ORM; Redis/BullMQ when background workloads justify it; S3-compatible object storage for media/private files; payment provider adapter; structured logs, metrics, traces and error tracking.

## Backend modules
Auth/Identity, Users, AccessControl, Societies/Memberships, Suppliers, Catalogue/Categories, Inventory, Campaigns/Pricing, Commitments/Cart, Orders, Payments/Refunds, Fulfilment, Settlements, Notifications, Support, Audit, Admin, Health. Modules own controllers, DTOs, services, persistence access and tests. Avoid circular dependencies.

## Frontend organisation
Suggested route groups: `(public)`, `(auth)`, `(buyer)`, `(society)`, `(supplier)`, `(operations)`. Shared `components/ui`, `components/domain`, `features/<domain>`, `lib/api`, `lib/auth`, `lib/validation`, `lib/formatting`. Use typed API contracts; keep client components small.

## Rules
Version API paths. Validate DTOs at write boundaries and reject unknown fields for sensitive writes. Thin controllers; business rules in services/policies. Stable error codes and request IDs. Never trust client price, total, status, role, tenant scope or payment success. Use DB transactions for invariants and outbox/queue for reliable async effects.

## Scale/reliability
Stateless API instances; connection pooling/timeouts; pagination on unbounded lists; query monitoring; rate limits by identity and endpoint; retries with backoff and failure visibility; idempotent workers; graceful shutdown and readiness checks. Cache only where staleness is acceptable. Keep external providers behind adapters.

## Deployment
Docker Compose for local PostgreSQL/Redis. Independently deploy frontend/backend. Prefer managed DB/storage where practical. Secrets belong in secret management, not source control. Provide `.env.example` placeholders. Avoid Kubernetes, microservices, service mesh, event sourcing or multiple databases without a documented measurable reason.

Concrete targets for this repository:
- **Web** → Vercel (root directory `apps/web`) or the `web` compose service.
- **API** → Render (Docker build from `infra/api.Dockerfile`) or the `api` compose service.
- **Database** → PostgreSQL 16 in compose locally, and a managed free-tier PostgreSQL (Render PostgreSQL or Neon) in deployment. `DATABASE_URL` is the only switch the API needs.
- Local development and automated tests may use SQLite (`DB_DRIVER=sqlite`) so contributors do not need a database server. SQLite is a development/test convenience, not the deployed target. Details in `DEPLOYMENT_OPERATIONS.md`.
