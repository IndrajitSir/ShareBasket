# Roadmap
Outcome-based phases; code existence alone does not mean a phase is complete. Deliver each milestone as small, dependency-ordered units that can be independently tested, reviewed and committed; do not wait for the whole milestone before committing verified units. Follow the authoritative workflow in `AGENT_RULES.md` and track verification/commit status in `TODO.md`.

## Phase 0 — Foundation
Inspect repo; choose ORM/auth/contracts; set up apps, environment validation, local DB, migrations/seeds, tests, lint/typecheck/build and CI. Break setup into independently verifiable units (for example, environment validation, one migration, and one CI check at a time); verify and commit each coherent unit. Exit: fresh contributor can run everything locally; decisions documented and checks pass. The initial UI-only sample campaigns are explicitly a prototype, not the real domain or persistence layer.

**Status (2026-10-31):** the workspaces, NestJS API, Next.js storefront, SQLite/PostgreSQL schema, seeds, tests and container/Render/Vercel assets are delivered and committed. Lint/format scripts, CI, a real PostgreSQL run and cloud smoke tests remain (`P0-07`, `P0-16`, `P0-17`, `P0-18` in `TODO.md`); Phase 0 is not complete until those pass.

## Phase 1 — Identity and community
Auth/profile/session; scope-aware RBAC; society and membership/invite approval; audit role/membership changes. Implement in small vertical slices, each with focused authorization tests and reviewable commits. Exit: negative tests pass across two users and societies.

**Status (2026-11-01):** email/password accounts, Google/GitHub OAuth wiring, login/register/account pages and the same-origin auth proxy are delivered. Society membership carries a scoped `MEMBER`/`STEWARD` role enforced by a society scope guard, new members need steward approval, and every request, decision, departure and role change is recorded in an append-only database-protected audit trail. Residence verification is delivered as the `P1-01f` slice: a per-society four-state claim lifecycle (`UNVERIFIED` → `PENDING` → `VERIFIED`/`REJECTED`) with a member-declared block/unit/tenancy, a member-only claim form, steward-only review that blocks self-review, an audit event per claim decision, and a steward-promotion gate on verified residents. `/account` lists each group and its pending state, and `/groups/[id]` is a steward console for the join queue, residency claims, roster and history. The explainable recommendations slice (`/for-you`, consented nearby groups) is delivered and tested. Invitations, request notifications, stale-claim expiry, duplicate-claim disputes, real OAuth consent and identity hardening remain; the phase is still in progress.

## Phase 2 — Supplier and catalogue
Supplier onboarding/verification; org users; categories/products/variants/media/inventory; moderation. Add schema, service/API, UI and tests incrementally, with each meaningful verified unit committed independently. Exit: supplier isolation verified.

## Phase 3 — Campaigns and pricing
Creation/approval/scheduling/expiry; tiers and server quotes; discovery/detail/progress; threshold outcome. Deliver campaign lifecycle and pricing rules as focused, testable units; verify edge cases before each commit. Exit: tier tests and concurrency limits pass.

## Phase 4 — Orders and sandbox payments
Idempotent order, immutable master/detail snapshots, payment adapter, webhook verification/dedup, order history. Verify and commit transaction, idempotency, adapter and webhook units separately where coherent; run integration checks at their boundaries. Exit: end-to-end order flow and retry tests pass.

## Phase 5 — Fulfilment/support/notifications
Pick/pack/dispatch/delivery status; support/disputes; async notification retries. Implement status transitions and exception paths in small units with focused tests and reviewable commits. Exit: delivery and exception paths work.

## Phase 6 — Finance/operations readiness
Refund/reconciliation/settlement; audit search; alerts; backup restore test; qualified legal/tax/privacy review. Exit: discrepancies detectable and runbooks exist.

## Phase 7 — Pilot
Small number of verified societies/suppliers; measure actual savings, conversion, quality, repeat rate and margin. Exit: agreed metrics meet targets and no unresolved critical/high issues.

## Phase 8 — Evidence-led scale
Potential delivery partners, recurring lists, society procurement, analytics, fraud controls and additional cities only when evidence supports them.
