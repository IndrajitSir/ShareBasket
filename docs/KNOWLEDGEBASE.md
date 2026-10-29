# Knowledgebase and Decision Log
## Glossary
Society = residential community and scope boundary. Buyer = purchasing user. Supplier = product provider. Campaign = time-bounded group-buying offer. Commitment = buyer quantity/order intent whose payment semantics must be explicit. Price tier = quantity threshold with price/discount. Master = relatively stable catalogue/reference/configuration record. Detail = transaction line/event/history. Scope = platform, society, supplier or assigned resource boundary. Idempotency = safe retry without duplicate effect. Outbox = durable record written with domain change for reliable async processing.

## Confirmed
Frontend Next.js + TypeScript; backend NestJS + TypeScript; modular monolith initially; PostgreSQL recommended; master/detail modelling required; RBAC must be role- and scope-aware; TODO is a continuously replenished queue; docs are living specifications.

## Assumptions to validate
Initial market India/INR; pilot starts with a small number of societies in one city; first products are household essentials; supplier/delivery model undecided; payment provider, seller of record, tax and settlement not selected; sandbox/mock payment allowed before approval for live integration; ORM/auth provider to be selected after repo inspection.

## Open questions before live transactions
1. Marketplace intermediary or seller of record?
2. Payment provider and settlement model?
3. Invoicing/GST/tax responsibilities? Obtain qualified advice.
4. Cancellation, returns, damaged item and refund policy?
5. Campaign final tier pricing or order-time locked tier?
6. Delivery cost/responsibility/liability?
7. Society/resident verification standard?
8. Supplier verification and suspension criteria?
9. Retention/deletion rules?
10. Pilot city, delivery radius and initial categories?

## Decision log template
Date; decision; context; options; chosen option/rationale; trade-offs; docs/code/tests updated; revisit trigger. Convert assumptions to decisions explicitly; never present an assumption as fact.
