# API Contracts
Base path `/api/v1`; JSON by default; DTO validation; OpenAPI/Swagger in development; ISO-8601 timestamps; currency explicit; money may serialize as decimal strings; pagination on lists; correlation/request ID in responses/logs.

## Error format
Use stable machine-readable codes, e.g. `{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [], "requestId": "..." }`. Never expose stack traces, SQL, tokens or raw provider errors.

## Endpoint groups
Auth: register/login/logout/refresh/verify/recovery/sessions. Users: current profile, permitted updates, privacy export. Societies: browse, request/create verification, membership join/leave/approve, invites. Suppliers: onboarding/profile/org users/verification. Catalogue: browse active categories/products; supplier-scoped CRUD; moderation. Campaigns: browse/detail/quote/create/update/submit/approve/publish/close. Orders: create, own list/detail, cancellation request, status timeline. Payments: create intent/session, provider webhook, refund request/status. Fulfilment: supplier queue and pick/pack/dispatch. Support: own tickets and assigned support operations. Admin: queues, moderation, refunds, audit with strict permission.

## Current implementation (NestJS, read-only preview)
Implemented under `/api/v1` by `apps/api`. All responses are JSON, every response carries an `X-Request-Id` header, and errors use the format above with a stable `code`.

- `GET /health` — liveness plus database connectivity. Returns `{ status, database, latencyMs, uptimeSeconds }` (`latencyMs` only when the probe succeeds); `503` with `status: "degraded"` when the database is unreachable.
- `GET /categories` — `{ categories: [{ key, label, blurb, image, productCount }] }`.
- `GET /products?category=&limit=&offset=` — paginated `{ items, page: { limit, offset, total } }`; `limit` 1–60, default 24. Unknown category returns an empty page, malformed values return `400 VALIDATION_ERROR`.
- `GET /products/:slug` — `{ product }` or `404 NOT_FOUND`.
- `GET /campaigns?category=&society=&sort=closing|progress` — `{ campaigns, previewOnly: true }`, each campaign including its product summary, society, location, `unitsCommitted`, `minimumUnits`, `closesAt` (ISO-8601), `deliveryDate` (ISO date), `tiers` (ordered), `currentUnitPricePaise`, `currentUnitPrice`, and `progress` (`percent`, `minimumMet`, `unitsRemaining`, `nextTier`).
- `GET /campaigns/:slug` — `{ campaign, previewOnly: true }` or `404 NOT_FOUND`.
- `POST /campaigns/:slug/quote` with `{ "quantity": 1..20 }` — prices the whole line at the tier its units would reach, including already-committed units. Returns `quote` (paise amounts plus formatted `unitPrice`, `lineTotal`, `currentUnitPrice`) and `previewOnly: true`. `400 VALIDATION_ERROR` for an invalid body or quantity, `404 NOT_FOUND` for an unknown campaign, `409 CAMPAIGN_CLOSED` for a closed campaign.

Campaign and product data is seeded sample data. These endpoints are not authenticated and expose no write path; quote requests create no commitment and reserve no stock. Do not add commitment, order, inventory or payment writes until authentication, scope-aware authorization, idempotency, transactions and the human-approved business rules exist. Swagger UI is served at `/api/docs` in non-production environments.

## Error codes in use
`VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401, reserved), `FORBIDDEN` (403, reserved), `NOT_FOUND` (404), `CAMPAIGN_CLOSED` (409), `INTERNAL_ERROR` (500). Client-facing messages never include stack traces, SQL or driver errors.

## Examples
`GET /campaigns?city=&category=&cursor=`; `GET /campaigns/:id`; `POST /campaigns/:id/quote`; `POST /orders` with `Idempotency-Key`; `GET /me/orders`; `GET /orders/:id`; `POST /orders/:id/cancellation-requests`; `POST /payments/:id/refund-requests`; `POST /webhooks/payments/:provider`.

Every protected endpoint authenticates and checks permission, scope and resource ownership in service/query logic. Recompute totals server-side, verify webhook signatures, deduplicate events, allow-list writable fields, and enforce lifecycle transitions. Never trust IDs alone as proof of ownership.
