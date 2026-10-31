# Community Bulk-Buying Marketplace Docs
This folder is the product source of truth for human and AI contributors. Read all documents before implementation and update them with code changes.

## Documents
- `PRODUCT.md`: vision, users, requirements, MVP and success metrics.
- `DESIGN.md`: UX, navigation, visual system and accessibility.
- `DATA_MODEL.md`: master/detail database model and integrity rules.
- `ARCHITECTURE.md`: Next.js/NestJS architecture and scaling.
- `RECOMMENDATIONS.md`: hybrid recommendation model, proximity/privacy rules and scaling.
- `API_CONTRACTS.md`: endpoint conventions and API rules.
- `RBAC_PERMISSIONS.md`: role- and scope-based authorization.
- `BUSINESS_RULES.md`: campaigns, pricing, orders, inventory, payments.
- `SECURITY_VULNERABILITY.md`: threat model and security controls.
- `TESTING.md`: test strategy and definition of done.
- `DEPLOYMENT_OPERATIONS.md`: environments, CI/CD, monitoring and backups.
- `KNOWLEDGEBASE.md`: glossary, assumptions, decisions and open questions.
- `ROADMAP.md`: phases and exit criteria.
- `TODO.md`: continuously replenished execution queue.
- `AGENT_RULES.md`: mandatory coding-agent process.
- `STARTER_PROMPT.md`: prompt to give the coding agent.

## Source-of-truth precedence
Product intent: `PRODUCT.md`; domain/data/access: `BUSINESS_RULES.md`, `DATA_MODEL.md`, `RBAC_PERMISSIONS.md`; security: `SECURITY_VULNERABILITY.md`; implementation: architecture/API/design; delivery: roadmap/TODO. Resolve conflicts explicitly and choose the safer option until clarified.

## Start here
Read every document, inspect the repository, record assumptions in `KNOWLEDGEBASE.md`, break Phase 0 into small tasks in `TODO.md`, then build vertical slices with UI, API, persistence, authorization, tests and docs.
