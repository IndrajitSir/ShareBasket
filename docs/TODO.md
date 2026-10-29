# Active TODO Queue
> Living execution loop. Never leave this empty while product goals remain unmet. Follow the authoritative **Incremental Development, Testing, and Git Commit Policy** in `AGENT_RULES.md`.

## Task tracking format
Give every task a stable ID and track its description, status, relevant tests/verification, commit hash after commit, and remaining work/blockers. Use `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `VERIFICATION_FAILED`, `VERIFIED`, `COMMITTED`, or `DONE`. `DONE` requires implementation, required verification, review, and a confirmed commit. For multi-unit features, record each unit/commit and keep the feature open until all required units are done.

## Current focus
Incrementally turn the read-only storefront prototype into an end-to-end marketplace. The next independently verifiable slice is a read-only campaign preview API; it remains unauthenticated sample data and must not accept live buyer or supplier records.

## In progress
- [ ] P0-01 | DONE | Inspect workspace, runtime, tooling and Git state. | Verify: workspace listing and runtime versions inspected. | Commit: — | Remaining/blockers: no application or package scripts existed in the initial checkout.
- [ ] P0-02 | DONE | Read the project documentation and resolve duplicate policy wording. | Verify: canonical docs reviewed; duplicate section removed. | Commit: — | Remaining/blockers: continue product setup.
- [ ] P0-03 | VERIFIED | Bootstrap the sample community campaign prototype: discovery and detail screens, integer-paise tier pricing, and a read-only `GET /api/campaigns` preview API. | Verify: 8 focused tests, `tsc --noEmit`, and production build passed; final diff reviewed; only unit files staged. | Commit: recorded after commit | Remaining/blockers: sample-only data; no accounts, persistence, commitments or payments.
- [ ] P0-03a | VERIFIED | Add server-authoritative campaign quote logic (`quoteCampaign`) and `POST /api/campaigns/:slug/quote`, wired to a quantity calculator on the campaign detail page. | Verify: 11 focused tests (tier boundaries, invalid/oversized quantity, closed campaign, API 400/404), `tsc --noEmit`, production build, and local dev-server checks of list/quote/detail/unknown-API responses. | Commit: recorded after commit | Remaining/blockers: quotes are computed from in-memory sample data and create no commitment; no persistence or auth.
- [ ] P0-04 | NOT_STARTED | Select ORM, auth/session approach and contract strategy based on repo evidence. | Verify: decisions and rationale documented. | Commit: — | Remaining/blockers: live product architecture pending.
- [ ] P0-05 | NOT_STARTED | Establish application structure and typecheck/lint/test/build scripts. | Verify: run available checks from project scripts. | Commit: — | Remaining/blockers: bootstrap stack.
- [ ] P0-06 | NOT_STARTED | Set up PostgreSQL, migrations, synthetic seeds and environment validation. | Verify: fresh setup and migration/schema checks. | Commit: — | Remaining/blockers: confirm app stack and ORM.
- [ ] P0-07 | NOT_STARTED | Add `.env.example` placeholders and CI quality gates. | Verify: inspect configuration; CI runs intended checks. | Commit: — | Remaining/blockers: never include real secrets.

## Backlog
- [ ] P0-08 | NOT_STARTED | Implement the persistent campaign, product, price-tier and community data model with migrations. | Verify: fresh/upgraded migration and constraint tests. | Commit: — | Remaining/blockers: ORM and database bootstrap.
- [ ] P0-09 | NOT_STARTED | Replace the sample catalogue source with a persistent, validated, read-only campaign repository/API without exposing write operations. | Verify: repository/API tests, malformed query/unknown campaign cases, and migration checks. | Commit: — | Remaining/blockers: choose runtime-compatible database/migration approach; API must not return unverified supplier or buyer data.
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

## Mandatory agent loop
For each meaningful unit, follow `AGENT_RULES.md`: inspect Git status and conventions; choose a small coherent change; implement and add appropriate tests; run focused verification; review changes and both staged/unstaged diffs; stage only related files; commit verified work locally; then update this queue with status, checks, commit hash and remaining work. After each task, add discovered bugs/dependencies, reassess the roadmap and write next actionable goals here. Continue until the product goal is met or a genuine human decision blocks progress. Do not stop just because the initial checklist is exhausted.

## Product goal
MVP requires end-to-end critical journeys, tested role/scope boundaries, transaction integrity, current docs and reproducible setup. Agent must not self-declare production readiness; human acceptance is required.

## Human blockers
Real payment provider/live transactions; legal/tax/seller-of-record policy; production credentials/domain/hosting; real customer data; irreversible production operations or destructive migrations.
