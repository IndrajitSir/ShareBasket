# Active TODO Queue
> Living execution loop. Never leave this empty while product goals remain unmet. Follow the authoritative **Incremental Development, Testing, and Git Commit Policy** in `AGENT_RULES.md`.

## Task tracking format
Give every task a stable ID and track its description, status, relevant tests/verification, commit hash after commit, and remaining work/blockers. Use `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `VERIFICATION_FAILED`, `VERIFIED`, `COMMITTED`, or `DONE`. `DONE` requires implementation, required verification, review, and a confirmed commit. For multi-unit features, record each unit/commit and keep the feature open until all required units are done.

## Current focus
The foundation is delivered: `apps/web` (Next.js) and `apps/api` (NestJS) are independent npm workspaces that share an HTTP JSON contract, sample catalogue/campaign data is persisted through TypeORM, and `infra/` carries container and Render assets. Next is the first real domain slice — identity, sessions and society membership — followed by validating the PostgreSQL/cloud deployment path and adding CI. The API remains read-only sample data and must not accept live buyer or supplier records until identity, authorization and transaction rules exist.

## Task ledger
- [x] P0-01 | DONE | Inspect workspace, runtime, tooling and Git state. | Verify: workspace listing and runtime versions inspected. | Commit: n/a (inspection only; no files changed) | Remaining/blockers: no application or package scripts existed in the initial checkout.
- [x] P0-02 | DONE | Read the project documentation and resolve duplicate policy wording. | Verify: canonical docs reviewed; duplicate section removed. | Commit: e8a116b | Remaining/blockers: none.
- [x] P0-03 | DONE | Bootstrap the sample community campaign prototype: discovery and detail screens, integer-paise tier pricing, and a read-only `GET /api/campaigns` preview API. | Verify: 8 focused tests, `tsc --noEmit`, and production build passed; final diff reviewed; only unit files staged. | Commit: 5d8ffdd | Remaining/blockers: superseded by the Next.js/NestJS migration; sample data only.
- [x] P0-03a | DONE | Add server-authoritative campaign quote logic (`quoteCampaign`) and a quote endpoint, wired to a quantity calculator on the campaign detail page. | Verify: 11 focused tests (tier boundaries, invalid/oversized quantity, closed campaign, API 400/404), `tsc --noEmit`, production build, and local dev-server checks. | Commit: 69a0e96 | Remaining/blockers: superseded by P0-13; quotes still create no commitment.
- [x] P0-04 | DONE | Select ORM, auth/session approach and contract strategy based on repo evidence. | Verify: decisions and rationale recorded in `KNOWLEDGEBASE.md`; HTTP JSON contract documented in `API_CONTRACTS.md`. | Commit: 18bad06 | Remaining/blockers: auth/session choice is deferred to P1-01.
- [x] P0-05 | DONE | Establish application structure and typecheck/test/build scripts. | Verify: `npm run typecheck`, `npm run test` (19 tests) and `npm run build` all exit 0 from the root. | Commit: 2ee7cb0 | Remaining/blockers: no lint/format script yet (P0-17).
- [x] P0-06 | VERIFIED | Set up database access, migrations, synthetic seeds and environment validation. | Verify: fresh SQLite migration and idempotent seed exercised through the CLI; `/api/v1/health` reports the database up. | Commit: 2ee7cb0 | Remaining/blockers: PostgreSQL path implemented but not exercised here (P0-16).
- [ ] P0-07 | IN_PROGRESS | Add `.env.example` placeholders and CI quality gates. | Verify: `apps/api/.env.example` and `apps/web/.env.example` contain fake placeholders only; compose config validates. | Commit: 2ee7cb0, c941326 | Remaining/blockers: CI workflow still missing (P0-17).
- [x] P0-10 | DONE | Document the monorepo topology (Next.js web, NestJS API, Docker infra, Vercel/Render targets) in `ARCHITECTURE.md`, `DEPLOYMENT_OPERATIONS.md`, `DATA_MODEL.md`, `API_CONTRACTS.md` and `KNOWLEDGEBASE.md`. | Verify: docs reconciled with the delivered layout, endpoints and verification limits. | Commit: 18bad06 | Remaining/blockers: none.
- [x] P0-11 | DONE | Convert the repository to npm workspaces with independently buildable `apps/web` and `apps/api`, removing the Vite SPA and Hono Worker. | Verify: root install, per-app scripts, `npm run build` and `npm run typecheck` pass; no Worker/Vite sources remain. | Commit: 2ee7cb0, c941326 | Remaining/blockers: none.
- [x] P0-12 | VERIFIED | Add TypeORM entities, initial migration and idempotent synthetic seed for categories, products, societies, campaigns and price tiers, with SQLite for local/test and PostgreSQL for deployment. | Verify: migration on a fresh SQLite database, seed run repeatedly without duplicates, unique/FK constraints covered by the API suite. | Commit: 2ee7cb0 | Remaining/blockers: PostgreSQL execution unverified (P0-16).
- [x] P0-13 | COMMITTED | Implement the `/api/v1` catalogue, campaign and quote endpoints in NestJS with DTO validation, stable error codes, request IDs, CORS allow-list and health check. | Verify: Jest unit and integration tests cover tier/quote boundaries, health, request-ID handling, filtering, pagination, not-found, closed-campaign, CORS and unknown API routes. | Commit: 2ee7cb0 | Remaining/blockers: no authentication or writes by design.
- [x] P0-14 | COMMITTED | Port the storefront to Next.js App Router and consume the API for all catalogue, campaign and quote data; remove fake order success from checkout. | Verify: Next.js typecheck and production build pass; pages and the quote calculator checked against the running API. | Commit: c941326 | Remaining/blockers: cart/checkout remain a labelled preview with no order API.
- [x] P0-15 | VERIFIED | Add Dockerfiles for web and API, compose with PostgreSQL, Render blueprint and deployment documentation. | Verify: `docker compose -f infra/docker-compose.yml config` exits 0; Dockerfiles, `render.yaml` and `vercel.json` reviewed. | Commit: 038ad6d | Remaining/blockers: images not built and PostgreSQL not started — Docker socket permission denied in this environment; no cloud deploy attempted.

## Backlog
- [x] P0-08 | DONE | Implement the persistent campaign, product, price-tier and community data model with migrations. | Verify: migration and constraint checks covered by the API suite on SQLite. | Commit: 2ee7cb0 | Remaining/blockers: delivered as part of P0-12.
- [x] P0-09 | DONE | Replace the sample catalogue source with a persistent, validated, read-only campaign repository/API without exposing write operations. | Verify: repository-backed API tests, malformed query and unknown campaign cases. | Commit: 2ee7cb0 | Remaining/blockers: delivered as part of P0-13; still sample data, not verified suppliers.
- [ ] P0-16 | BLOCKED | Validate the PostgreSQL deployment path: migrations, seed and read endpoints against PostgreSQL 16. | Verify: run `migration:run` and `seed` against PostgreSQL, then check `/api/v1/health`, catalogue and quote responses. | Commit: — | Remaining/blockers: no reachable PostgreSQL server and Docker socket permission denied; use Render/Neon or a locally permitted PostgreSQL.
- [ ] P0-17 | NOT_STARTED | Add lint/format scripts and a CI workflow that runs typecheck, tests and builds on a clean checkout. | Verify: CI runs the same commands listed in `TESTING.md` and fails on a real violation. | Commit: — | Remaining/blockers: choose the CI provider (GitHub Actions assumed).
- [ ] P0-18 | BLOCKED | Smoke-test the Render API and Vercel frontend, then record the deployed URLs, environment variables and CORS settings. | Verify: deployed health check, campaign page and browser quote request succeed cross-origin. | Commit: — | Remaining/blockers: requires human cloud accounts plus authorization to deploy.
- [ ] P1-01 | NOT_STARTED | Implement account/profile and society membership with scoped access. | Verify: authentication and cross-society negative tests. | Commit: — | Remaining/blockers: auth provider/product requirements.
- [ ] P3-01 | NOT_STARTED | Replace sample campaigns and demand counts with authorized API data and server-calculated quotes. | Verify: permission, price-boundary and integration tests. | Commit: — | Remaining/blockers: persisted domain model, API contract and verified suppliers.
- [ ] P3-02 | NOT_STARTED | Add a validated, idempotent commitment workflow with transactional stock/threshold updates. | Verify: transaction, retry, race and closed-campaign tests. | Commit: — | Remaining/blockers: data model, auth and human-approved business rules.

- [ ] B-01 | NOT_STARTED | Scope-aware RBAC and negative tests. | Verify: role/scope boundary tests. | Commit: — | Remaining/blockers: identity foundation.
- [ ] B-02 | NOT_STARTED | Society membership workflow. | Verify: membership API/UI and authorization tests. | Commit: — | Remaining/blockers: identity/RBAC.
- [ ] B-03 | NOT_STARTED | Supplier onboarding/approval. | Verify: onboarding and supplier-scope tests. | Commit: — | Remaining/blockers: identity/RBAC.
- [ ] B-04 | NOT_STARTED | Catalogue, variants and inventory. | Verify: schema, migration, validation and inventory tests. | Commit: — | Remaining/blockers: supplier foundation.
- [ ] B-05 | NOT_STARTED | Campaigns, tiers and server-side quotes. | Verify: pricing boundary and campaign lifecycle tests. | Commit: — | Remaining/blockers: catalogue/inventory.
- [ ] B-06 | NOT_STARTED | Idempotent orders with master/detail records and immutable snapshots. | Verify: transaction, retry and snapshot tests. | Commit: — | Remaining/blockers: pricing and inventory.
- [ ] B-07 | NOT_STARTED | Sandbox payment adapter and webhook verification/deduplication. | Verify: signature, replay and idempotency tests. | Commit: — | Remaining/blockers: order flow; live money needs approval.
- [ ] B-08 | NOT_STARTED | Fulfilment state transitions, audit, support and notifications. | Verify: transition, scope and failure-path tests. | Commit: — | Remaining/blockers: order foundation.
- [ ] B-09 | NOT_STARTED | Buyer/supplier/society/operations UI routes. | Verify: relevant component/accessibility checks and typecheck. | Commit: — | Remaining/blockers: APIs and product flows.
- [ ] B-10 | NOT_STARTED | Observability, security scans, backups and restore docs. | Verify: scans and documented restore exercise. | Commit: — | Remaining/blockers: deployment setup.

## Verification snapshot (2026-10-31)
Run from the repository root on a clean working tree:

- `npm run typecheck` → exit 0 for `apps/api` and `apps/web`.
- `npm test` → exit 0, 19 tests in 2 suites (pricing unit tests plus API integration tests against a migrated, seeded SQLite database).
- `npm run build` → exit 0 (NestJS compile and Next.js production build).
- `docker compose -f infra/docker-compose.yml config` → exit 0 (topology syntax only).
- `docker info` → permission denied for `/var/run/docker.sock`; container images were not built and the compose stack was not started.
- PostgreSQL, Render and Vercel remain unverified. Do not describe the product as deployment-ready until P0-16 and P0-18 pass.

## Mandatory agent loop
For each meaningful unit, follow `AGENT_RULES.md`: inspect Git status and conventions; choose a small coherent change; implement and add appropriate tests; run focused verification; review changes and both staged/unstaged diffs; stage only related files; commit verified work locally; then update this queue with status, checks, commit hash and remaining work. After each task, add discovered bugs/dependencies, reassess the roadmap and write next actionable goals here. Continue until the product goal is met or a genuine human decision blocks progress. Do not stop just because the initial checklist is exhausted.

## Product goal
MVP requires end-to-end critical journeys, tested role/scope boundaries, transaction integrity, current docs and reproducible setup. Agent must not self-declare production readiness; human acceptance is required.

## Human blockers
Real payment provider/live transactions; legal/tax/seller-of-record policy; production credentials/domain/hosting; real customer data; irreversible production operations or destructive migrations.
