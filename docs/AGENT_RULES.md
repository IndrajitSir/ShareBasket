# Mandatory AI Agent Rules
## Documentation first
Read `README.md` and every document in `docs/` before code changes. Inspect the existing repo; do not assume it is empty or overwrite working code blindly. Docs are living specs and must be updated in the same task as relevant code/schema/API changes. Resolve conflicts explicitly. Ask the human for choices affecting money, law, irreversible actions, product direction or material security/privacy; record reversible low-risk choices.

## TODO loop — non-negotiable
`TODO.md` must always contain next actionable goals while the product is incomplete. Every time existing TODO items are completed, update TODO with next possible goals before ending the session. Never stop because the initial checklist is exhausted: inspect roadmap, code gaps, test gaps and security findings; add tasks and continue until product goal is met or a genuine blocker needs human input. Tasks must be small, dependency-ordered and testable. Never claim unverified work done. Report checks and blockers honestly.

## Product and engineering
Build an end-to-end usable product, not only a landing page/static mock. Use Next.js App Router and NestJS with TypeScript. Prefer modular monolith. PostgreSQL unless repo constraints justify documented alternative. Follow master/detail semantics in `DATA_MODEL.md`. Use migrations, FKs, constraints and indexes. Controllers thin; DTOs validated; domain logic in services/policies. Backend is authoritative for prices, permissions, state and transactions. Use decimal-safe money, atomic stock reservations, idempotency and concurrency controls.

## Security/RBAC
Every protected API action authenticates and checks permission, scope and ownership. Default deny. UI hiding is not security. Never trust client roles, price, totals, status, tenant IDs or payment success. Test negative role/scope cases. Never commit secrets or real PII. Use safe sessions, validation, rate limits, audit logs and scans. Do not enable live payments without explicit human approval and reviewed provider/legal configuration.

## Quality
Follow sound existing conventions; avoid needless rewrites. Strict TypeScript where feasible; do not silence errors without documented justification. Test critical flows. Paginate unbounded lists and avoid N+1. Provide accessible responsive UI and loading/empty/error/success/forbidden states; respect reduced motion. Keep dependencies purposeful. Never invent package APIs or savings claims.

## Incremental Development, Testing, and Git Commit Policy
Use this section as the authoritative workflow for every meaningful change; `TESTING.md` defines minimum verification, and `TODO.md` tracks task and commit status.

1. Before each unit, inspect the relevant code, tests, conventions, and `git status --short`. Preserve and identify pre-existing user changes.
2. Choose the smallest coherent, independently verifiable unit. Implement it with appropriate focused tests; do not combine unrelated work or create artificial commits for trivial edits.
3. Run the smallest sufficient checks for that unit using commands confirmed in the project scripts/tooling. Fix failures introduced by the change; record unrelated failures or environment blockers honestly. Do not weaken or hide tests to pass.
4. Review the final change for correctness, regressions, security, secrets, generated artifacts, and accidental modifications. Inspect both `git diff` and `git diff --cached`; stage only files belonging to the unit.
5. Once a meaningful unit passes verification and review, create a local commit before starting unrelated implementation work. Prefer descriptive Conventional Commit messages (for example, `feat(groups): add group-buy creation endpoint`). Do not commit incomplete work or claim a commit without confirming it exists.
6. Update `TODO.md` after each unit with its ID, description, status, relevant verification, commit hash (when committed), and remaining work/blockers. Do not mark a task `DONE` until implementation, required checks, and commit are complete. Keep multi-unit features in progress until all required units are complete.
7. Never stage the whole repository blindly. Never commit secrets, real environment files, credentials, private keys, production data, dependencies, build output, or temporary files unless established project conventions require generated artifacts.
8. Local commits are part of the workflow; never push, force-push, rewrite existing history, amend/squash/reset commits, open/merge a PR, or change Git identity/configuration unless explicitly requested. Investigate hook failures; do not bypass them automatically. If Git state, identity, permissions, or hooks prevent a commit, report the exact blocker and leave changes uncommitted.
9. At session end, report completed work, exact verification and results, confirmed commit hashes/messages, current Git status, uncommitted changes and why, updated TODO items, blockers, and the next recommended task. Never describe unrun checks or unconfirmed commits as successful.

## Change/completion protocol
Inspect migrations before schema changes; plan safe backfill/rollback. Avoid destructive/prod actions without approval. Update tests and docs with schema/API/permission changes. Before saying complete: run relevant tests/lint/typecheck/build or state why not; review diff for secrets/access leaks; update TODO and Knowledgebase; report changed files, verification, limitations and next goals.
