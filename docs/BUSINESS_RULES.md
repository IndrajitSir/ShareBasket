# Business Rules
## Campaign lifecycle
Suggested: `DRAFT → SUBMITTED → APPROVED → SCHEDULED/OPEN → CLOSED → FULFILMENT_PENDING → FULFILLED`; terminal alternatives `CANCELLED`, `EXPIRED`, `FAILED_MINIMUM`. Supplier edits own drafts; operations approval before public release. Validate time window, eligibility, threshold unit and stock caps server-side. No commitments after close/terminal state. Price tiers must be ordered, unambiguous and validated. Decide and disclose whether all buyers receive the final campaign tier or each order locks its quoted tier; record choice in Knowledgebase.

## Pricing
Server calculates prices/taxes/fees; use decimal arithmetic and snapshot quote/version. Show unit price, quantity, discount, tax, service/delivery fees and total before confirmation. Savings require a defensible reference price with source/time and equivalent unit; otherwise do not claim savings. Version or snapshot supplier price/tax/fee rules.

## Residence verification
Each society membership carries an independent residence verification state: `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`. It is scoped to the group, separate from email or identity verification, and only stores the block/unit and tenancy type (`OWNER`, `TENANT`, `FAMILY`), never documents or full street addresses. A member submits the declaration themselves; only a different steward of the same society can approve or reject it. A verified resident may be promoted to steward, so group authority is tied to a reviewed address claim in that society only.

## Orders
Suggested states: `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `READY_FOR_DISPATCH`, `DISPATCHED`, `DELIVERED`; alternatives `PAYMENT_FAILED`, `CANCEL_REQUESTED`, `CANCELLED`, `PARTIALLY_FULFILLED`, `RETURN_REQUESTED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`. Central transition policy records actor, timestamps, old/new state and reason. Browser redirect is not payment proof. Cancellation after dispatch requires support/policy flow. Refunds are separate records; never erase original transactions.

## Inventory
Validate/reserve in a transaction. Release expired reservations idempotently. Prevent negative stock/overcommitment. Track inventory movements. Decide whether stock reserves at quote/order/payment initiation; use short-lived expiry where appropriate.

## Invitations and notifications
Pending join requests, residence claims and their decisions are currently reviewed only inside the group; email/other notifications and stale-claim expiry are tracked separately (P1-01f remaining).

## Payments/refunds
Provider adapter; sandbox first. Verify signatures and deduplicate webhook events. Store minimal metadata and provider refs, never card data/secrets. Refund cannot exceed captured amount minus previous refunds. Higher-risk refund/settlement may require separate approver. Reconcile pending, failed, duplicate and mismatched transactions.

## Residence verification
Membership can carry an independent residence verification state (`UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) scoped to one society. It stores only the member-declared block, unit and tenancy type (`OWNER`, `TENANT`, `FAMILY`); the society already holds the street location, so no document, identity number or raw address is collected or persisted. A member submits the claim themselves; only a different steward of the same society may verify or reject it, and self-review is refused. Only a verified resident may be promoted to steward, so group authority is tied to a reviewed address claim in that society only. Verification is separate from email or identity verification, and it does not grant extra powers beyond that society's scheme.

## Invitations and notifications
Join requests, claim decisions and related events are still reviewed inside the group UI for now; email/other notifications, stale-claim expiry and duplicate-claim disputes belong to `P1-01f` and are not yet implemented.

## Residence verification
Membership can carry an independent residence verification state (`UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) scoped to one society. It stores only the member-declared block, unit and tenancy type (`OWNER`, `TENANT`, `FAMILY`); the society already holds the street location, so no document, identity number or raw address is collected or persisted. A member submits the claim themselves; only a different steward of the same society may verify or reject it, and self-review is refused. Only a verified resident may be promoted to steward, so group authority is tied to a reviewed address claim in that society only. Verification is separate from email or identity verification, and it does not grant extra powers beyond that society's scheme.

## Invitations and notifications
Join requests, claim decisions and related events are still reviewed inside the group UI for now; email/other notifications, stale-claim expiry and duplicate-claim disputes belong to `P1-01f` and are not yet implemented.

## Residence verification
Membership can carry an independent residence verification state (`UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) scoped to one society. It stores only the member-declared block, unit and tenancy type (`OWNER`, `TENANT`, `FAMILY`); the society already holds the street location, so no document, identity number or raw address is collected or persisted. A member submits the claim themselves; only a different steward of the same society may verify or reject it, and self-review is refused. Only a verified resident may be promoted to steward, so group authority is tied to a reviewed address claim in that society only. Verification is separate from email or identity verification, and it does not grant extra powers beyond that society's scheme.

## Invitations and notifications
Join requests, claim decisions and related events are still reviewed inside the group UI for now; email/other notifications, stale-claim expiry and duplicate-claim disputes belong to `P1-01f` and are not yet implemented.

## Residence verification
Membership can carry an independent residence verification state (`UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) scoped to one society. It stores only the member-declared block, unit and tenancy type (`OWNER`, `TENANT`, `FAMILY`); the society already holds the street location, so no document, identity number or raw address is collected or persisted. A member submits the claim themselves; only a different steward of the same society may verify or reject it, and self-review is refused. Only a verified resident may be promoted to steward, so group authority is tied to a reviewed address claim in that society only. Verification is separate from email or identity verification, and it does not grant extra powers beyond that society's scheme.

## Invitations and notifications
Join requests, claim decisions and related events are still reviewed inside the group UI for now; email/other notifications, stale-claim expiry and duplicate-claim disputes belong to `P1-01f` and are not yet implemented.

## Fulfilment and notifications
Store delivery address snapshot. Limit supplier visibility to necessary fulfilment data. Track late/missing/damaged deliveries as support/disputes. Use retryable asynchronous notifications; avoid private address/order details in lock-screen text; respect preferences and applicable law.

## Decisions required before live money
Payment provider and settlement model; seller of record; invoicing/tax/GST treatment with qualified advice; cancellations/returns/refunds; pricing finalisation; delivery responsibility/liability; supplier and society verification criteria; residence dispute resolution when two accounts are approved for the same unit, and whether stewards or a separate reviewer handles that.
