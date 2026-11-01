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
- `society_membership_detail`: `id`, `user_id`, `society_id`, `status` (`PENDING` | `ACTIVE`, default `PENDING`), `role` (`MEMBER` | `STEWARD`, default `MEMBER`), `joined_at`; unique `(user_id, society_id)`, index `(society_id, status)`, cascade on user, restrict on society. The role applies to that one society only. A join creates a `PENDING` request that grants no access; an active steward of that society approves (row becomes `ACTIVE`) or rejects (row is deleted so the account may ask again). The first member of an empty society is bootstrapped as an active steward. Address/tenancy verification and invitations are still missing.
- `society_audit_event`: `id`, `society_id`, nullable `actor_user_id`/`actor_name`, `action` (`MEMBERSHIP_REQUESTED`, `MEMBERSHIP_APPROVED`, `MEMBERSHIP_REJECTED`, `MEMBERSHIP_LEFT`, `ROLE_CHANGED`, `STEWARD_BOOTSTRAPPED`, `STEWARD_SUCCEEDED`), `target_user_id`/`target_name`, nullable `from_status`/`to_status`/`from_role`/`to_role`, `created_at`; index `(society_id, created_at)`. **Append-only**: migration `1793000000006` creates triggers that abort `UPDATE` and `DELETE` on both SQLite and PostgreSQL. Actor and target display names are snapshotted at write time, and there is intentionally no FK to `user_master`, so deleting an account cannot erase authorization history.
- `user_campaign_signal_detail`: `id`, `user_id`, `campaign_id`, `signal_type` (`QUOTE`), `weight` (quantity, 1–20), `created_at`; indexes on user and campaign, cascade on both. Signals are implicit interest, not purchases. One row exists per `(user_id, campaign_id)` (unique `uq_signal_user_campaign`) and a repeated quote updates its weight; writes are rate-limited per member in the API process.
- `recommendation_snapshot`: `scope` (varchar 40, primary key — currently `global`), `payload` (text JSON: schema version, build time, anonymous trending order, item-item affinity edges), `computed_at`, `version` (check `>= 1`). One row per scope; it is a rebuildable cache, not business data, so losing or deleting it only costs one recompute. No user, location or per-member data is stored in the payload.

Personalised recommendation sections are still computed at request time from these tables; only trending and item-item affinity are precomputed into `recommendation_snapshot`. There is no model blob or raw location column on users. Recommendation queries count only `ACTIVE` memberships: a pending request is shown back to its owner but never unlocks that society's campaigns or contributes to collaborative filtering.

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
