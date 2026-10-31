# Data Model
## Persistence
Use PostgreSQL for transactional data. ORM: TypeORM; use migrations consistently. Redis may later serve cache/queues/rate limits but is not the authority for stock, orders or payments.

Development and automated tests may use SQLite (`DB_DRIVER=sqlite`) so the API can run without a database server. Entities, constraints and migrations must remain portable to PostgreSQL; SQLite is never the deployed target. Do not use driver-specific SQL in migrations — build tables through TypeORM's `Table`/`queryRunner` API.

### Implemented schema (read-only slice)
`category_master` → `product_master`; `society_master` → `campaign_master` → `campaign_product_master` (one product per campaign, extensible to many) and `campaign_price_tier_detail`. Money is stored as integer **paise** (`*_paise`) rather than `numeric`, which is exact and portable across both drivers; repositories must reject fractional or negative amounts. `product_master.details_json` and option values use TypeORM `simple-json` columns for display metadata only, never for queryable business state. UUID primary keys; unique slugs, unique `(campaign_id, minimum_units)` tiers and check constraints on quantities/prices are enforced in the schema.

### Identity (implemented)
`user_master`: `id` (UUID), unique normalised `email`, `name`, nullable `password_hash` (bcrypt, never selected by default), nullable `avatar_url`, nullable `oauth_provider` (`google` | `github`), nullable `oauth_subject`, `created_at`, `updated_at`. A unique `(oauth_provider, oauth_subject)` index prevents duplicate provider identities. Local accounts have a password hash and `oauth_provider = 'local'`; linking an OAuth identity to a local account keeps the password hash. Email uniqueness is the account key, so a second OAuth provider cannot be attached to the same email yet. Session JWTs are stateless and are **not** stored in the database; logout only clears the cookie. A future `refresh_session_detail`/identity table is required before token revocation or multi-provider linking.

### Recommendations and groups (implemented)
- `society_master` gains nullable `latitude`/`longitude` (`float` for driver portability). Sample societies are seeded with synthetic Bengaluru coordinates; real coordinates must be verified. Raw coordinates are used only for server-side distance and are not returned by the nearby endpoint.
- `society_membership_detail`: `id`, `user_id`, `society_id`, `status` (`ACTIVE`), `joined_at`; unique `(user_id, society_id)`, cascade on user, restrict on society. This is an immediate preview membership — no approval, role or verification fields yet.
- `user_campaign_signal_detail`: `id`, `user_id`, `campaign_id`, `signal_type` (`QUOTE`), `weight` (quantity, 1–20), `created_at`; indexes on user and campaign, cascade on both. Signals are implicit interest, not purchases. Repeated quotes are allowed and intentionally overweight interest until deduplication/rate limiting exists.

Recommendation responses are computed at request time from these tables; there is no model blob or raw location column on users.

## Mandatory master/detail convention
Master tables hold relatively stable identity, catalogue, reference or configuration data. Detail/transaction tables hold line items, activity, movements, events and history. Examples: `product_master` → `product_variant_master`; `order_master` → `order_detail` + `order_status_history`; `payment_master` → `payment_transaction_detail` + `refund_detail`; `society_master` → `society_membership_detail`; `campaign_master` → `campaign_product_master`, `campaign_price_tier_detail`, `campaign_commitment_detail`; `delivery_master` → `delivery_item_detail` + status history. Use conventional names where clearer; document exceptions. Do not force naming mechanically.

## Proposed entities
Identity/access: `user_master`, `role_master`, `permission_master`, `user_role_detail` (role + scope type/id), `role_permission_detail`, `refresh_session_detail`, `audit_log_detail`.
Community: `society_master`, `society_membership_detail`, `society_invite_master` (store token hash), `address_master`.
Supplier/catalogue: `supplier_master`, `supplier_user_detail`, `category_master`, `product_master`, `product_variant_master`, `product_media_detail`, `inventory_balance_master`, `inventory_movement_detail`.
Campaigns: `campaign_master`, `campaign_product_master`, `campaign_price_tier_detail`, `campaign_commitment_detail`.
Transactions: `order_master`, `order_detail`, `order_status_history`, `payment_master`, `payment_transaction_detail`, `refund_detail`, `delivery_master`, `delivery_item_detail`, `delivery_status_history`, `supplier_settlement_master`, `supplier_settlement_detail`.
Support/platform: `support_ticket_master`, `support_message_detail`, `notification_master`, `notification_delivery_detail`, `consent_detail`, `privacy_request_master`.

## Key fields and rules
Use UUID PKs unless repository conventions justify otherwise; separate human-readable unique order number. PostgreSQL `timestamptz`, UTC instants. Use decimal/Numeric for money, never float; persist currency. Use quantity precision appropriate to units. Add FKs, unique/check constraints and indexes based on queries. Use explicit lifecycle statuses and transition rules. Snapshot order item name/SKU/unit/quantity/unit price/discount/tax/fees at checkout; do not rewrite historical orders when catalogue changes. Do not delete financial/audit history; use reversal/void records. Minimise PII; never store card data/CVV or plain tokens.

## Transaction safety
Order creation, stock reservation and campaign commitment must be atomic. Use row locks, optimistic versions or suitable isolation to prevent overselling. Idempotency for orders, payments, refunds and webhook events. Verify payment webhook signatures and deduplicate provider event IDs. Use outbox/durable jobs for reliable side effects. Do not hold DB transactions open during remote API calls.

## Indexes/constraints
Unique normalised email/phone when supplied; supplier-scoped SKU; campaign status + time + scope; buyer/date and society/status order indexes; unique provider event ID; scoped idempotency key. Positive quantities, nonnegative prices/fees, refund cap, valid campaign window and non-overlapping tiers. Review query plans with realistic data.

Maintain a Mermaid ER diagram once schema stabilises and update schema docs, migrations and tests together.
