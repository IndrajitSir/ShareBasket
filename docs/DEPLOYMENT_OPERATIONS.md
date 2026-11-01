# Deployment Operations Guide

This document explains how the project ships and where each piece runs. It is
a human-readable companion to the code; it does not authorize any production
change and never contains live credentials.

## Repositories and build targets

- **Frontend:** `apps/web` — Next.js App Router application.
- **Backend:** `apps/api` — NestJS REST API.
- **Infra:** `infra/` — Dockerfiles and Compose for local parity with the
  deployed shapes.

Monorepo root is the repository root; workspaces are in `apps/` and shared
config lives alongside them. There is no separate `src/` prototype tree in the
current shipping layout.

The same images are intended to run in three deployment shapes:

1. **Vercel + Render** — free-tier defaults.
2. **AWS** — container/EC2 or ECS-style deploy.
3. **Virtual machine** — manual deploy of the same artifacts.

No deployment is assumed complete until it is smoke-tested against the real
environment and the results are recorded in `TODO.md`.

## Shared development loop

For each meaningful change, follow the incremental workflow in
`AGENT_RULES.md` and the verification commands in `TESTING.md`. Do not merge a
feature into the project until its own unit tests and the relevant type/lint
checks pass, the diff has been reviewed, and the change is committed.

## Local development

- Install from the repository root with the project's package manager.
- Start the backend and frontend as separate processes during development.
- Keep the backend behind the same-origin proxy when the frontend is the entry
  point, so sessions stay first-party.
- Do not commit real secrets; use placeholders in `.env.example` files.

## Docker and Compose

`infra/docker-compose.yml` describes the intended local topology, including the
database and services the app expects. Validate the Compose file with
`docker compose -f infra/docker-compose.yml config` before relying on the
layout; building and starting the stack requires the Docker socket, which may be
unavailable in this environment.

The Dockerfiles are kept minimal and deterministic:
- `infra/api.Dockerfile` — the NestJS API.
- `infra/web.Dockerfile` — the Next.js frontend.

Both should produce artifacts that can run outside Docker, so the same code can
be deployed to Render, AWS or a VM without a different branch or a different
build pipeline.

## Deployment shapes

### Vercel + Render

- The frontend is deployed to Vercel from `apps/web`.
- The backend is deployed to Render from `apps/api`.
- Keep environment names, CORS origins and session cookie settings consistent
  across environments.
- Free deployments are fine for previews and internal pilots; do not treat them
  as production-ready until the relevant security, observability and backup
  checks exist.

### AWS

- Package the same backend and frontend artifacts.
- Provide managed PostgreSQL or an equivalent reachable database for the API.
- Keep TLS termination consistent with the session cookie settings the API
  expects.

### Virtual machine

- Install the same runtime used in the Dockerfiles.
- Run migrations and seed before serving traffic.
- Manage TLS and process supervision externally; the app does not assume a
  managed runtime.

## Database

The schema supports PostgreSQL for deployment and SQLite for local/test work.
Before any migration is applied to production data:
- Review the migration and rollback path.
- Use a backup or a restore exercise where appropriate.
- Do not apply destructive migrations without explicit human approval.

## Configuration

- Shared behavior is read from the runtime environment at startup.
- Required configuration is validated on start; the app should refuse to start
  with missing critical settings where that is part of the contract.
- Never print, log or commit real secret values.

## Smoke checks

Before declaring any environment healthy, confirm:
- Health and database connectivity.
- Auth/sign-in and session handling at the real origin.
- At least one read endpoint returns expected shapes.
- The frontend proxy, if used, forwards the session correctly.

Record the environment, URL, checks performed and any remaining blockers in
`TODO.md` when a deployment is smoke-tested.

## Rollback and recovery

- Keep deployable artifacts and migration history deployable in reverse order
  where the framework supports it.
- Have a restore exercise before relying on backups in production.
- Prefer reversible changes for risky steps; do not edit production data in ways
  that cannot be audited or rolled back without a human decision.

## Documentation ownership

- `ARCHITECTURE.md` — high-level topology and components.
- `API_CONTRACTS.md` — implemented endpoint shapes and error contracts.
- `DATA_MODEL.md` — current entities, fields and relationships.
- `RBAC_PERMISSIONS.md` — implemented scope and role model, including what is
  not yet in place.
- `BUSINESS_RULES.md` — product rules and open decisions.
- `RECOMMENDATIONS.md` — recommendation model and privacy choices.
- `TODO.md` — current task and deployment verification status.
- `AGENT_RULES.md` — the authoritative development and commit policy.
- `TESTING.md` — minimum verification before committing.
- `README.md` — quickstart orientation.
- `KNOWLEDGEBASE.md` — decisions and rationale.
- `DEPLOYMENT_OPERATIONS.md` — this file.
