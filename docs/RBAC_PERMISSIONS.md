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

## Implemented scope model (pilot)
The pilot implements the society slice of the model above and nothing else. It is intentionally one resource type, so the generic permission catalogue is still aspirational.

### Roles
The `society_membership_detail.role` column holds `MEMBER` or `STEWARD`. A role is meaningful **only inside that membership row**: there is no platform-level role, no global administrator, and no role inheritance between societies. A member of several societies can be a steward in one and a plain member in another, and the tests cover exactly that.

### Approval, bootstrap and invariants
- A membership row has a `status`: `PENDING` or `ACTIVE`. Only `ACTIVE` rows grant access. A request is visible to the requesting account and to stewards of that same society, never to other members.
- The **first member of an empty society** is bootstrapped as an `ACTIVE` `STEWARD`; otherwise a group could never admit anyone. Every later join creates a `PENDING` `MEMBER` request.
- A steward **approves or rejects** a pending request. Approval activates the existing row; rejection deletes it so the account may ask again later. Both decisions are audited.
- Re-joining while active or pending is idempotent: it returns the stored membership and never changes its role or status.
- A **departing steward** hands the role to the earliest remaining `ACTIVE` member, so a group with active members always has a steward. Pending requests are never candidates. A departing plain member changes nobody's role.
- A steward **cannot change their own role** (`409 CONFLICT`); a steward hands the role to someone else, who can then hand it back.
- The service also refuses a change that would leave a society without a steward. With self-change blocked this is a defensive check against concurrent demotions, not a reachable user flow.
- **Known race:** two simultaneous first joins can both observe an empty group and both become `STEWARD`. The unique `(user_id, society_id)` index keeps one membership each; the duplicate steward is benign because any steward can demote the other.

### Enforcement path
1. `SessionAuthGuard` resolves the session cookie or trusted bearer token and sets `request.user`.
2. `SocietyScopeGuard` reads `:societyId` from the **route**, validates its UUID shape, and resolves the caller's role from an `ACTIVE` row in `society_membership_detail`. A `PENDING` request resolves to no role, so holding a request is not membership.
3. `@RequireSocietyRole('STEWARD')` sets the minimum role for a handler; without it the requirement is `MEMBER`, never public.
4. The verified `{ societyId, role }` is attached to the request and read through `@CurrentMembership()`; controllers never accept a role from the body as authority.

Failures: `401 UNAUTHENTICATED` without a session; `403 FORBIDDEN` for a non-member or an insufficient role (including a steward of another society acting here); `404 NOT_FOUND` for an unknown or malformed society id. Non-members are told `403` rather than being shown whether a society exists unless it truly does not, which costs one extra lookup on the denial path only.

### Routes
- `GET /societies/:societyId/members` — requires `MEMBER`. Returns the group's public identity, the caller's verified role and a roster of `{ userId, name, role, joinedAt }`. A steward also receives `pendingRequests` and the recent `auditTrail`; both are empty arrays for plain members. **Names only**: no emails, phone numbers, addresses or coordinates.
- `GET /societies/:societyId/requests` — requires `STEWARD`. Returns `{ societyId, requests: [{ userId, name, requestedAt }] }`, oldest first.
- `POST /societies/:societyId/requests/:userId/approve` — requires `STEWARD`. Activates the pending row and returns `{ member }`. `404` when no such request exists; `409` when it is no longer pending.
- `DELETE /societies/:societyId/requests/:userId` — requires `STEWARD`. Deletes the pending request, `204`. The rejected account may ask again later.
- `PATCH /societies/:societyId/members/:userId` with `{ role }` — requires `STEWARD`. Validates the role enum, rejects unknown fields, and returns the updated member. Only `ACTIVE` members can be targeted.

The Next.js page `/groups/[id]` renders the roster through a server component and server actions, so the session cookie stays first-party. Its steward buttons are convenience only; hiding them is not the authorization boundary. A pending requester sees a waiting page with a cancel action instead of the roster.

### Audit trail
Every approval, rejection, join request, departure, role change and automatic steward handoff writes a row to `society_audit_event`. The table is append-only **at the database level**: migration `1793000000006` installs triggers that reject `UPDATE` and `DELETE` for both SQLite and PostgreSQL. The application exposes no write path other than one `INSERT`, and there is no endpoint that edits or deletes history. Rows snapshot the actor and target display names so the trail survives account deletion; there is deliberately no foreign key to `user_master`.

### Still missing
Address/tenancy verification, invitations, email notifications for requests and decisions, platform roles (`BUYER`, `SOCIETY_ADMIN`, `SUPPLIER_*`, `OPERATIONS`, `FINANCE`, `SUPPORT`, `PLATFORM_ADMIN`), generic permission checks, and any global scope. Do not describe the platform as having full RBAC until those exist.
