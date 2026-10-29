# RBAC and Scope Model
Implement role-based **and scope-aware** authorization. A role is not sufficient: supplier users are limited to their organisation; society admins to their society. Every protected backend action checks identity, permission, scope and resource ownership. Default deny.

## Roles
- `BUYER`: own profile, addresses, orders and support; eligible campaign browsing.
- `SOCIETY_ADMIN`: membership and society operations within assigned approved society; cannot grant platform roles.
- `SUPPLIER_OWNER`: own supplier organisation and allowed commercial settings.
- `SUPPLIER_STAFF`: assigned catalogue/fulfilment tasks; no settlement/refund approval by default.
- `OPERATIONS`: supplier/product/campaign/fulfilment review within permissions.
- `FINANCE`: finance/reconciliation/refund/settlement actions; dual approval for higher-risk actions where appropriate.
- `SUPPORT`: assigned tickets, sensitive fields masked by default.
- `PLATFORM_ADMIN`: platform settings and role administration; all privileged actions audited.
- `SYSTEM`: non-human, least-privilege service identity, not an interactive login.

## Permission examples
`campaign:read/create/update/approve/close`; `order:read:own`, `order:read:society`, `order:read:supplier`, `order:create`, `order:fulfil`; `supplier:manage:own`, `supplier:verify`; `society:manage:own`, `membership:approve:own_society`; `payment:read:own`, `refund:request/approve`, `settlement:manage`; `role:assign`, `audit:read`, `support:manage:assigned`.

## Enforcement
Frontend guards are UX only. Derive scope from verified server-side memberships/org links, not arbitrary client IDs. Prevent horizontal and vertical privilege escalation. Users cannot grant themselves roles/scopes. Role changes require authorization and audit. Test every role/scope boundary with negative tests. Do not implement impersonation without explicit need, time limits, banner and audit.
