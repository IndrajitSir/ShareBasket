# Design and UX
## Direction
Modern, credible commerce experience—community-oriented, calm, transparent and operationally dependable. Avoid coupon-site clutter, excessive gradients/glass, tiny text and animation that slows checkout.

## Visual system
Use design tokens for colour, spacing, typography, radius, elevation and semantic states. Suggested palette: warm neutral surfaces, deep ink text, restrained forest/teal green for positive progress, one warm accent. Prices use clear ₹ formatting; separate unit price, quantity, fees, tax and total. Never invent savings or supplier badges.

## Information architecture
Public: home, how it works, campaign discovery/detail, supplier onboarding, help/policies, auth.
Buyer: eligible campaigns, search/categories, campaign detail, checkout, orders/detail, notifications, society membership, addresses, support, profile/privacy.
Society admin: overview, membership queue, residents, announcements/campaigns, delivery coordination, settings.
Supplier: verification, organisation users, products/variants/inventory, offers/tiers, orders, dispatch, permitted settlement/performance views.
Operations: users/societies/suppliers, moderation, campaigns, orders/payments/refunds, disputes, audit, roles/settings.

## UX patterns
Search is available in the header and on the shop/campaign listings, with the query kept in the URL and preserved across filters and sort. Auth pages keep a single-column form, label every field, show inline errors, offer email/password as the always-available path and reveal OAuth buttons only when the server has that provider configured. Signed-in state should be visible in the header without flashing a false identity.

Campaign cards show product/unit, current tier price, progress, deadline, delivery estimate and CTA. Progress includes text, not colour alone. Price breakdown lists unit price, discount, quantity, tax, service/delivery fees and total. Forms need labels, help, validation and errors. Tables need server-side pagination/filtering and mobile alternatives. Provide loading, empty, success, error, not-found, unauthenticated and forbidden states.

## Responsive/accessibility
Mobile-first buyer flow; persistent sidebar for desktop operations portals, compact mobile navigation. Keyboard support, visible focus, semantic headings/landmarks, accessible errors/dialog focus, sufficient contrast, meaningful alt text, touch-friendly targets and reduced-motion support. Aim for WCAG 2.2 AA. No scroll hijacking or long intro animations.

## Frontend conventions
Next.js App Router + TypeScript. Server Components by default; client components only for interaction/browser APIs. Typed API client; keep secrets/server-only data out of client bundles. Frontend route guards improve UX but never replace backend authorization. Keep business logic out of presentational components.
