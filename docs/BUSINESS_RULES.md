# Business Rules
## Campaign lifecycle
Suggested: `DRAFT → SUBMITTED → APPROVED → SCHEDULED/OPEN → CLOSED → FULFILMENT_PENDING → FULFILLED`; terminal alternatives `CANCELLED`, `EXPIRED`, `FAILED_MINIMUM`. Supplier edits own drafts; operations approval before public release. Validate time window, eligibility, threshold unit and stock caps server-side. No commitments after close/terminal state. Price tiers must be ordered, unambiguous and validated. Decide and disclose whether all buyers receive the final campaign tier or each order locks its quoted tier; record choice in Knowledgebase.

## Pricing
Server calculates prices/taxes/fees; use decimal arithmetic and snapshot quote/version. Show unit price, quantity, discount, tax, service/delivery fees and total before confirmation. Savings require a defensible reference price with source/time and equivalent unit; otherwise do not claim savings. Version or snapshot supplier price/tax/fee rules.

## Orders
Suggested states: `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `READY_FOR_DISPATCH`, `DISPATCHED`, `DELIVERED`; alternatives `PAYMENT_FAILED`, `CANCEL_REQUESTED`, `CANCELLED`, `PARTIALLY_FULFILLED`, `RETURN_REQUESTED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`. Central transition policy records actor, timestamps, old/new state and reason. Browser redirect is not payment proof. Cancellation after dispatch requires support/policy flow. Refunds are separate records; never erase original transactions.

## Inventory
Validate/reserve in a transaction. Release expired reservations idempotently. Prevent negative stock/overcommitment. Track inventory movements. Decide whether stock reserves at quote/order/payment initiation; use short-lived expiry where appropriate.

## Payments/refunds
Provider adapter; sandbox first. Verify signatures and deduplicate webhook events. Store minimal metadata and provider refs, never card data/secrets. Refund cannot exceed captured amount minus previous refunds. Higher-risk refund/settlement may require separate approver. Reconcile pending, failed, duplicate and mismatched transactions.

## Fulfilment and notifications
Store delivery address snapshot. Limit supplier visibility to necessary fulfilment data. Track late/missing/damaged deliveries as support/disputes. Use retryable asynchronous notifications; avoid private address/order details in lock-screen text; respect preferences and applicable law.

## Decisions required before live money
Payment provider and settlement model; seller of record; invoicing/tax/GST treatment with qualified advice; cancellations/returns/refunds; pricing finalisation; delivery responsibility/liability; supplier and society verification criteria.
