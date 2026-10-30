# Product Requirements
## Vision
Help households in residential societies get everyday products at better prices by aggregating demand, negotiating transparent volume pricing with verified suppliers, and coordinating reliable delivery.

## Principles
- Real, explainable savings; no fake discounts, scarcity, reviews or trust badges.
- Trust, fulfilment quality and privacy before growth.
- Society-first operations and mobile-first usability.
- Modular monolith first; scale based on evidence, not hype.

## Users
Buyer/resident; society administrator; supplier owner/staff; operations/moderation; finance; support; platform administrator; narrowly scoped system automation.

## Core journey
Register/verify → join a society → browse eligible campaigns → inspect product, thresholds, tier prices, deadline, delivery and fees → quote/checkout → reserve stock safely → payment provider confirms server-side → track order → receive delivery → raise support/refund request if needed.

## Core capabilities
1. Authentication, profile, sessions and privacy controls.
2. Society directory, membership requests, invite codes and scoped administration.
3. Supplier onboarding, verification, organisation users and catalogue.
4. Categories, products, variants, media, units, inventory and movements.
5. Campaigns with opening/closing times, minimum thresholds, eligibility and volume price tiers.
6. Server-side quotes, price snapshots, orders, payment abstraction, refunds and reconciliation.
7. Supplier picking/packing/dispatch, delivery tracking and status history.
8. Notifications, support tickets, disputes, audit logs and operations dashboards.
9. RBAC with object ownership and society/supplier scope enforcement.

## MVP
Deliver a working end-to-end product: auth; society membership; supplier onboarding; catalogue; campaigns and tiers; discovery/detail UI; safe order placement; sandbox/mock payment adapter clearly labelled; order tracking; basic fulfilment; admin queues; audit logs; notifications; responsive accessible UI; seed data; automated tests; reproducible local setup.

## Non-goals initially
Owned warehouses/fleet, ERP suite, autonomous AI pricing, multi-country tax, microservices/Kubernetes without evidence, raw card storage, social feed.

## Revenue hypotheses
Supplier commission/margin, transparent service fee, clearly labelled sponsored supplier placement, later B2B procurement. Validate unit economics before hard-coding a model.

## Metrics
Verified societies with active campaigns; campaign conversion/completion; repeat purchase at 30/60/90 days; verified savings net of fees; on-time/complete delivery; cancellations/refunds/complaints; contribution margin; support resolution time; security incidents.

## Acceptance criteria
Backend calculates all prices/totals; order lines preserve historical price/tax/fee snapshots; duplicate requests/webhooks cannot duplicate effects; progress and stock cannot be client-manipulated; buyers cannot access other buyers' private data; suppliers and society admins are scope-isolated; privileged actions are audited; critical flows have automated tests.

## Current prototype scope
A read-only marketplace preview is the current slice: a Next.js storefront (`apps/web`) consuming a NestJS API (`apps/api`) backed by TypeORM-persisted sample categories, products, societies, campaigns and price tiers. It shows sample group-buy campaigns with community progress, integer-paise tier pricing, category/community filters, campaign detail pages and a server-priced quantity quote. The bag and checkout screens are a clearly labelled preview and create no order, commitment, stock reservation or payment. It does not create accounts or represent live supplier offers. See `KNOWLEDGEBASE.md` for the reversible stack decision and `TODO.md` for the follow-on identity, authorization, order and payment work.
