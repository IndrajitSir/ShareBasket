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
The workspace currently contains a read-only catalogue and campaign preview API plus the storefront that consumes it. There is no authentication, order, payment, inventory or commitment write path yet; those modules must be added as separate vertical slices with authorization, transactions and idempotency before any real buyer or supplier data is stored.

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
