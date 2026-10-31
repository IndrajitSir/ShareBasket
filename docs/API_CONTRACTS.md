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
- `GET /products?category=&q=&limit=&offset=` — paginated `{ items, page: { limit, offset, total } }`; `limit` 1–60, default 24. `q` is a trimmed, case-insensitive search over product name, short description and description (maximum 80 characters). Unknown category returns an empty page, malformed values return `400 VALIDATION_ERROR`.
- `GET /products/:slug` — `{ product }` or `404 NOT_FOUND`.
- `GET /campaigns?category=&society=&q=&sort=closing|progress` — `{ campaigns, previewOnly: true }`, each campaign including its product summary, society, location, `unitsCommitted`, `minimumUnits`, `closesAt` (ISO-8601), `deliveryDate` (ISO date), `tiers` (ordered), `currentUnitPricePaise`, `currentUnitPrice`, and `progress` (`percent`, `minimumMet`, `unitsRemaining`, `nextTier`). `q` matches product name/description, society name or location (maximum 80 characters).
- `GET /campaigns/:slug` — `{ campaign, previewOnly: true }` or `404 NOT_FOUND`.
- `POST /campaigns/:slug/quote` with `{ "quantity": 1..20 }` — prices the whole line at the tier its units would reach, including already-committed units. Returns `quote` (paise amounts plus formatted `unitPrice`, `lineTotal`, `currentUnitPrice`) and `previewOnly: true`. `400 VALIDATION_ERROR` for an invalid body or quantity, `404 NOT_FOUND` for an unknown campaign, `409 CAMPAIGN_CLOSED` for a closed campaign. When the request carries a valid session, the API also records a best-effort `QUOTE` interest signal used by recommendations; failure to record it never fails the quote.

Campaign and product data is seeded sample data. These endpoints expose no write path; quote requests create no commitment and reserve no stock. Do not add commitment, order, inventory or payment writes until scope-aware authorization, idempotency, transactions and the human-approved business rules exist. Swagger UI is served at `/api/docs` in non-production environments.

## Authentication (implemented)
Authentication lives in the NestJS API. The browser never receives a bearer token: the API sets an **HttpOnly, `SameSite=Lax` cookie** named `sb_session` (JWT, 7-day expiry, `Secure` when `NODE_ENV=production`). The Next.js app exposes only the same-origin proxy `/api/backend/auth/*`, so the cookie stays first-party on the Vercel origin and cannot be read by client JavaScript. Server components may call the API directly with the forwarded cookie. The API also accepts `Authorization: Bearer <token>` for trusted server clients.

- `POST /auth/register` with `{ email, password, name }` — creates an account and sets the session cookie. `201 { user }`; `409 CONFLICT` for an existing email; `400 VALIDATION_ERROR` for an invalid email, a password shorter than 8 or longer than 72 characters, or a name outside 2–80 characters. Passwords are hashed with bcrypt; the hash is never returned.
- `POST /auth/login` with `{ email, password }` — `200 { user }` and sets the cookie; `401 UNAUTHENTICATED` with a generic message for unknown email or wrong password.
- `POST /auth/logout` — `204`, clears the cookie. The JWT remains valid until expiry if it was captured elsewhere; revocation is not implemented.
- `GET /auth/me` — `200 { user }` for a valid cookie or bearer token, otherwise `401 UNAUTHENTICATED`.
- `GET /auth/providers` — `{ google: boolean, github: boolean }` based on server configuration, used to hide unusable OAuth buttons.
- `GET /auth/google` and `GET /auth/github` — start the Authorization Code flow. `302` to the provider, with a short-lived HttpOnly `sb_oauth_state` cookie. `503 SERVICE_UNAVAILABLE` when that provider's client ID/secret are not configured.
- `GET /auth/google/callback` and `GET /auth/github/callback` — validate `state` against the cookie, exchange the code server-side, require a verified provider email, upsert the user by `(provider, subject)` or link an existing unlinked email, set the session cookie, and `302` to `${PUBLIC_WEB_URL}/account?welcome=1`. Failures redirect to `/login?error=oauth` without exposing provider or token details; a mismatched/missing `state` is rejected.

Public user shape: `{ id, email, name, avatarUrl, provider, createdAt }` where `provider` is `local`, `google` or `github`. Email/password sign-in remains available after an OAuth link. OAuth is optional per provider. Not implemented: email verification, password reset, MFA, login rate limiting and multiple OAuth identities per account; an email already linked to a different provider is rejected with `409 CONFLICT` rather than silently merged.

## Recommendations and groups (implemented)
Recommendations are computed server-side from group demand, quote signals, item-item collaborative filtering and, for nearby groups, consented coordinates. Model details and limitations are in `RECOMMENDATIONS.md`; no purchase history is claimed.

- `GET /recommendations` — optional session. Returns `{ signedIn, personalized, needsGroup, needsLocation, groups, sections: { inYourGroups, otherGroups, trending }, model: { name, version, generatedAt } }`. Anonymous callers get `trending`; signed-in users without groups get `needsGroup: true` and `needsLocation: true`. Section items contain a campaign summary (`slug`, product, society, location, price, progress, close date), a human `reason` and a `source` (`YOUR_GROUPS`, `OTHER_GROUPS`, `TRENDING`). Top six per section, de-duplicated by product; the user's own quoted campaigns are excluded.
- `POST /recommendations/nearby` with `{ "latitude": -90..90, "longitude": -180..180, "radiusKm": 1..50 }` — **requires a session**. Computes Haversine distance in memory, discards coordinates after the response and returns `{ radiusKm, groups: [{ id, name, location, distanceKm, memberCount, activeCampaigns, topCampaign }] }`. Coordinates are never persisted, logged or echoed; `distanceKm` is rounded to one decimal. Invalid ranges return `400 VALIDATION_ERROR`.
- `GET /me/groups` — **requires a session**. Returns the caller's societies with `memberCount` and `activeCampaigns`.
- `POST /me/groups/:societyId` — **requires a session**. Idempotently joins a preview group membership; `201 { group }` or `404 NOT_FOUND` for an unknown society.
- `DELETE /me/groups/:societyId` — **requires a session**. Leaves the group; `204`, or `404 NOT_FOUND` when not a member.

Preview memberships are immediate: there is no approval queue, role grant or address verification yet. Never treat `societyId` as proof of residence.

## Error codes in use
`VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403, reserved), `NOT_FOUND` (404), `CONFLICT` (409), `CAMPAIGN_CLOSED` (409), `SERVICE_UNAVAILABLE` (503), `INTERNAL_ERROR` (500). Client-facing messages never include stack traces, SQL, tokens or driver errors.

## Examples
`GET /campaigns?city=&category=&cursor=`; `GET /campaigns/:id`; `POST /campaigns/:id/quote`; `POST /orders` with `Idempotency-Key`; `GET /me/orders`; `GET /orders/:id`; `POST /orders/:id/cancellation-requests`; `POST /payments/:id/refund-requests`; `POST /webhooks/payments/:provider`.

Every protected endpoint authenticates and checks permission, scope and resource ownership in service/query logic. Recompute totals server-side, verify webhook signatures, deduplicate events, allow-list writable fields, and enforce lifecycle transitions. Never trust IDs alone as proof of ownership.
