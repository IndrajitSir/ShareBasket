# Deployment and Operations
Maintain local, CI/test, staging and production environments. Do not copy production data into dev without approved anonymisation.

## Configuration/local setup
`.env.example` contains descriptions and fake placeholders only. Validate required env at startup. Separate sandbox/live provider credentials. Never commit `.env`, credentials, signing keys or private dumps. Provide Docker Compose for PostgreSQL/Redis if used, and document install/migrate/seed/run/test/reset commands. Seeds are synthetic; demo payment mode is clearly labelled. Destructive reset scripts must refuse non-local environments.

## CI/CD
Formatting/lint → typecheck → tests → build → dependency/secret scan → migration validation → staging deploy → smoke tests → production approval. Use rollback-capable deployment and backward-compatible schema migrations.

## Observability
Structured logs with correlation IDs; metrics for latency/errors, DB pool, queue lag, campaign conversion, payment outcomes and delivery delays; tracing where feasible. Alert on 5xx, webhook failures, queue backlog, backup failures, order/stock mismatches and suspicious admin activity. Redact PII/secrets.

## Recovery/runbooks
Encrypted backups and point-in-time recovery where available. Define RPO/RTO before launch and test restore regularly. Document payment-provider outage, database outage, queue backlog, compromised account, leaked secret, privacy request, supplier suspension, campaign cancellation and failed delivery.
