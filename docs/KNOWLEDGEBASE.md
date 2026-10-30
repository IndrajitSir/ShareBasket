# Knowledgebase and Decision Log
## Glossary
Society = residential community and scope boundary. Buyer = purchasing user. Supplier = product provider. Campaign = time-bounded group-buying offer. Commitment = buyer quantity/order intent whose payment semantics must be explicit. Price tier = quantity threshold with price/discount. Master = relatively stable catalogue/reference/configuration record. Detail = transaction line/event/history. Scope = platform, society, supplier or assigned resource boundary. Idempotency = safe retry without duplicate effect. Outbox = durable record written with domain change for reliable async processing.

## Confirmed
Frontend Next.js + TypeScript; backend NestJS + TypeScript; modular monolith initially; PostgreSQL recommended; master/detail modelling required; RBAC must be role- and scope-aware; TODO is a continuously replenished queue; docs are living specifications.

## Assumptions to validate
Initial market India/INR; pilot starts with a small number of societies in one city; first products are household essentials; supplier/delivery model undecided; payment provider, seller of record, tax and settlement not selected; sandbox/mock payment allowed before approval for live integration; ORM/auth provider to be selected after repo inspection.

## Open questions before live transactions
1. Marketplace intermediary or seller of record?
2. Payment provider and settlement model?
3. Invoicing/GST/tax responsibilities? Obtain qualified advice.
4. Cancellation, returns, damaged item and refund policy?
5. Campaign final tier pricing or order-time locked tier?
6. Delivery cost/responsibility/liability?
7. Society/resident verification standard?
8. Supplier verification and suspension criteria?
9. Retention/deletion rules?
10. Pilot city, delivery radius and initial categories?

## Decision log

### 2026-10-30 — Runtime stack for the prototype
- **Context:** The docs specify Next.js App Router + NestJS + PostgreSQL, but the working repository is a Vite + React SPA served by a Hono Worker on Cloudflare Workers (with a Sites deploy manifest), and the sandbox has no PostgreSQL server.
- **Options:** (a) rebuild as Next.js + NestJS + PostgreSQL now, (b) build buyer-facing slices on the existing Worker stack and document the deviation, (c) stop and ask before writing product code.
- **Chosen:** (b). Build small, verified vertical slices on the existing stack; keep domain logic (paise pricing, progress, quotes) in plain TypeScript modules so it can move to a NestJS service later without rewriting rules.
- **Trade-offs:** No SQL persistence, migrations, sessions or RBAC yet; the Worker has no Node runtime, so anything depending on `pg`/TypeORM cannot run here. Data is in-memory sample data.
- **Docs/tests updated:** `PRODUCT.md` (prototype scope), `API_CONTRACTS.md` (implemented preview endpoints), `ROADMAP.md`, `TODO.md` (P0-03, P0-03a, P0-09), `tests/campaigns.test.mjs`.
- **Revisit trigger:** Before real supplier/buyer data or any persistence requirement — decide between D1 on Workers and a separately hosted NestJS/PostgreSQL API. This is a product-owner decision, so it is recorded rather than assumed.

### 2026-10-30 — Monorepo restructure with a real API
- **Context:** The prototype was a single Vite/React SPA with a Hono Worker. The product requires an independently deployable Next.js frontend and NestJS backend, and the user requested Docker images plus free Vercel/Render hosting.
- **Options:** (a) keep the Worker and proxy to a hosted database, (b) restructure into `apps/web` (Next.js App Router) + `apps/api` (NestJS) + `infra` Docker assets, (c) defer the backend and only move files.
- **Chosen:** (b). Catalogue and campaigns are now persisted through TypeORM and served by NestJS under `/api/v1`; the Next.js app fetches those endpoints server-side for pages and browser-side for the quantity quote.
- **Money representation:** authoritative amounts are integer **paise** in the database and API, never floating point. Formatting to `₹` happens at the presentation boundary. This satisfies the decimal-safety rule without a decimal column driver difference between SQLite and PostgreSQL.
- **Database drivers:** PostgreSQL is the deployment target. SQLite (`better-sqlite3`) is supported for local development and automated tests because this workspace cannot run a PostgreSQL server; the same TypeORM entities and migration run on both. The PostgreSQL deployment path is implemented but not exercised in this environment — see the session report.
- **Trade-offs:** No authentication, orders, payments, inventory or commitment writes yet. The cart and checkout remain a clearly labelled preview with no order API. The old Hono Worker, Vite SPA, Cloudflare deploy manifest and their tests were removed rather than left as a second implementation.
- **Revisit trigger:** Before any buyer/supplier data or write endpoint — add identity, scope-aware authorization, idempotency and transaction tests. Validate the API against a real PostgreSQL instance (Docker/Render/Neon) before declaring deployment ready.

## Decision log template
Date; decision; context; options; chosen option/rationale; trade-offs; docs/code/tests updated; revisit trigger. Convert assumptions to decisions explicitly; never present an assumption as fact.
