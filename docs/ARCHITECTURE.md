# Architecture
Use a modular monolith with clean boundaries; extract services only when measured needs justify it.

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
