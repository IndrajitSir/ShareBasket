# API Contracts
Base path `/api/v1`; JSON by default; DTO validation; OpenAPI/Swagger in development; ISO-8601 timestamps; currency explicit; money may serialize as decimal strings; pagination on lists; correlation/request ID in responses/logs.

## Error format
Use stable machine-readable codes, e.g. `{ "statusCode": 400, "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [], "requestId": "..." }`. Never expose stack traces, SQL, tokens or raw provider errors.

## Endpoint groups
Auth: register/login/logout/refresh/verify/recovery/sessions. Users: current profile, permitted updates, privacy export. Societies: browse, request/create verification, membership join/leave/approve, invites. Suppliers: onboarding/profile/org users/verification. Catalogue: browse active categories/products; supplier-scoped CRUD; moderation. Campaigns: browse/detail/quote/create/update/submit/approve/publish/close. Orders: create, own list/detail, cancellation request, status timeline. Payments: create intent/session, provider webhook, refund request/status. Fulfilment: supplier queue and pick/pack/dispatch. Support: own tickets and assigned support operations. Admin: queues, moderation, refunds, audit with strict permission.

## Current implementation (sample preview only)
The existing Hono Worker exposes `GET /api/campaigns` and `GET /api/campaigns/:slug` for the storefront prototype. Responses contain sample campaign/product display fields, server-derived tier/progress values, and `previewOnly: true`; these endpoints are read-only. They are not authenticated, persistent, or suitable for real supplier, buyer, inventory, quote, or order data. Do not add commitments/payment writes until persistence, authentication, authorization, idempotency, and the applicable human-approved business rules are implemented.

## Examples
`GET /campaigns?city=&category=&cursor=`; `GET /campaigns/:id`; `POST /campaigns/:id/quote`; `POST /orders` with `Idempotency-Key`; `GET /me/orders`; `GET /orders/:id`; `POST /orders/:id/cancellation-requests`; `POST /payments/:id/refund-requests`; `POST /webhooks/payments/:provider`.

Every protected endpoint authenticates and checks permission, scope and resource ownership in service/query logic. Recompute totals server-side, verify webhook signatures, deduplicate events, allow-list writable fields, and enforce lifecycle transitions. Never trust IDs alone as proof of ownership.
