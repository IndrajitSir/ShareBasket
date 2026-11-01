# Recommendations

## What this is (and is not)
The product has no orders or payment history yet, so a trained purchase model would be fiction. This is an **explainable hybrid recommender** over real available signals:

1. **Group demand** — sample campaign units committed and how close each campaign is to its minimum.
2. **Peer interest** — campaign quote signals from signed-in users, grouped by society membership.
3. **Item-item collaborative filtering** — users who quoted a campaign also quoted another (cosine similarity over implicit quote signals).
4. **Proximity** — Haversine distance between the browser's consented location and known society coordinates.
5. **Urgency** — campaigns closing sooner rank slightly higher.

There is no Python service, model server, GPU, vector database or external ML API. Scoring runs in the NestJS process against PostgreSQL, so the same container works on Render, AWS and a VM. The session-independent parts — anonymous trending and item-item co-occurrence — are already precomputed into a persisted snapshot (below), so an offline job can later take over the same interfaces without changing the API contract.

## Sections returned
`GET /api/v1/recommendations/for-you` (optional session cookie):

- `inYourGroups` — campaigns in the user's societies, ranked by other members' quote signals, campaign demand, similar-item affinity and urgency. The user's own quoted campaigns are excluded.
- `otherGroups` — campaigns outside the user's societies (every open campaign for a member with no groups, capped at three so trending keeps distinct products), ranked by cross-group demand, collaborative affinity, urgency and same-city affinity. Empty for signed-out visitors.
- `trending` — cold-start fallback for anonymous users or users without signals.
- `nearbyGroups` — **not** included here. It requires browser permission and a separate request.

Flags: `signedIn`, `needsGroup` (signed in with no **active** memberships — a pending request counts as no group), `needsLocation` (those users should be offered the location prompt), `personalized` (at least one active membership). The `groups` array still includes pending requests, each with `status: "PENDING"`, so the page can explain the wait; section rankings ignore them.

## Algorithm (model `hybrid-demand-cf`, version `1.0.0`)
All scores are normalized to 0–1 and combined with fixed weights; the implementation is a pure function with unit tests.

```
groups   = ACTIVE memberships of current user (pending requests do not count)
peers    = users sharing any of those societies, excluding current user
peerW[c] = sum of quote weights for campaign c by peers
demand[c] = min(1, unitsCommitted / minimumUnits)
urgency[c] = clamp(1 - daysUntilClose / 14, 0, 1)

cf[c] = mean over user's quoted campaigns o of cosine(users(c), users(o))
        where cosine = |users(c) ∩ users(o)| / sqrt(|users(c)| * |users(o)|)
        and the current user is removed from both sets

inGroupScore  = 0.45 * demand + 0.35 * peerNorm + 0.15 * cfNorm + 0.05 * urgency
otherScore    = 0.55 * demand + 0.25 * cfNorm + 0.15 * urgency + 0.05 * sameCity
trendingScore = 0.85 * demand + 0.15 * urgency
```

`peerNorm` and `cfNorm` divide by the maximum in the candidate set. The top six per section are returned, de-duplicated by product. Every item carries a human `reason` such as `"3 neighbours quoted this"`, `"Minimum met in Maple Residency"` or `"Closest open group nearby"`.

Cold start is deliberate: a signed-out visitor sees trending only; a signed-in member with no groups sees capped cross-group picks, the nearby-group prompt and trending, never an in-group claim; no location just means no distance sorting; no quote signals falls back to campaign demand.

## Proximity and privacy
- The browser asks for location only after an explicit **Use my location** click. It never asks on page load.
- Coordinates are sent to a same-origin Next.js server action, which forwards them to `POST /api/v1/recommendations/nearby` in a JSON body. They never appear in a URL, browser history, proxy log or the API's request log. The API validates ranges, computes distance in memory and **does not persist, log or return raw coordinates**.
- Only societies with coordinates are candidates. Responses expose a rounded distance (`distanceKm`, one decimal), never the society's raw latitude/longitude.
- `radiusKm` defaults to 10 and is capped at 50.
- Nearby search requires a signed-in session so it cannot be used as an anonymous group-directory scraper.
- Seed coordinates are synthetic Bengaluru locations for sample societies. Real deployments must populate verified coordinates; do not infer a resident's home from a group.

## User interface (`/for-you`)
The Next.js page renders three labelled sections: **What your neighbours are buying** (in-group), **What other groups are buying** (cross-group) and **Trending this week** (cold start). Every card states its reason, current unit price, progress and closing date, and links to the campaign. Signed-out visitors see trending plus a sign-in prompt rather than any personalized claim.

A signed-in member with no active group sees **Your group picks start with a group** and the nearby panel. The panel requests browser location only when **Use my location** is pressed; it handles permission denial, unavailable location and a 1–50 km radius, then lists groups with a rounded distance, member count, open campaign count and the busiest campaign. **Ask to join** creates a request: a group that already has members stays pending until one of its stewards approves it, while an empty group bootstraps the first member as its steward. Pending requests appear on `/account` and at `/groups/[id]` with a cancel action, and grant no campaign access. Users can browse every group buy without ever sharing a location.

## Signal writes, deduplication and rate limiting
A quote stores implicit interest only. One row exists per `(member, campaign)` in `user_campaign_signal_detail`, enforced by the unique index `uq_signal_user_campaign`; a repeated quote updates that row's bounded weight (1–20) instead of adding a second data point. Peer counts and weights therefore cannot be inflated by quoting the same campaign repeatedly. The migration that introduces the index also collapses any pre-existing duplicates, keeping the highest quoted quantity.

Signal writes are additionally rate-limited per member with an in-process sliding window: default **30 signals per minute**, configurable with `SIGNAL_RATE_LIMIT_PER_MINUTE` (validated integer 0–10000, `0` disables). A denied write is skipped and never fails the quote response. Unknown campaign slugs are ignored before consuming a slot. Because the counter is in-process, a multi-replica deployment applies the limit per replica; move the counter to a shared store only when a measured abuse pattern requires it.

The limiter is deliberately about write amplification, not authorization: any signed-in member may quote. Quote spam protection for the quote endpoint itself and login/registration rate limiting remain separate hardening tasks (`P1-02`).

## Precomputed snapshot cache
`RecommendationSnapshotsService` keeps the expensive, session-independent half of the model out of the request path. `buildRecommendationSnapshot` makes one deterministic pass over open campaigns and quote signals and produces:

- the anonymous **trending order** (`0.85 × demand + 0.15 × urgency`, top 50), and
- symmetric **item-item affinity** edges (co-quote cosine similarity, the 10 strongest neighbours per campaign).

The payload is stored as one JSON row in `recommendation_snapshot` (scope `global`, with a monotonically increasing `version`) and served from memory while fresh:

- **TTL** — 5 minutes. An expired row is rebuilt on the next read.
- **Restart** — a fresh persisted row is reused, so a new instance or replica does not recompute on boot.
- **Invalidation** — a successful quote signal write drops the cache and schedules one debounced (1 s) background rebuild. The next read resolves it synchronously if the timer has not fired; a burst of quotes therefore causes one rebuild, not one per write.
- **Failure** — if the snapshot cannot be read or rebuilt, `/for-you` logs a warning and ranks with the per-request signal scan it already loads. A cache problem degrades ordering quality, never the page.
- **Scope** — only trending and affinities are shared. The caller's own quoted campaigns and neighbour weights still come from the request's signal load, so nothing personal is stored in the shared row.

The cache is in-process with a database-backed copy, so replicas each hold their own memory copy but agree on the persisted payload; no Redis or worker process is required. Budgets are enforced by `apps/api/test/recommendation-latency.spec.ts`: a snapshot over 800 campaigns and 1,200 signals must build in under 1.5 s, ranking the full candidate set in under 750 ms, and a warm read must average under 5 ms with zero database queries.

## Membership semantics
`GET /me/groups`, `GET /me/groups/:societyId`, `POST /me/groups/:societyId` and `DELETE /me/groups/:societyId`. Joining creates a `PENDING` request that a steward of that society approves or declines; the first member of an empty group is bootstrapped as its steward. There is no invite or address verification yet. Each membership carries a role scoped to that society (`MEMBER` or `STEWARD`), approvals and role changes are written to an append-only audit trail, and a departing steward hands the role to the earliest active member. Group-scoped actions are authorized by `SocietyScopeGuard`, and `/groups/[id]` shows the roster to members, the review queue and history to stewards, and a waiting page to requesters. See `RBAC_PERMISSIONS.md`. Recommendations use active society ids only — a pending request is never personalisation and a role is never read or inferred.

## Scalability and deployment
The MVP loads open campaigns, memberships and quote signals and scores them in memory. That is appropriate for a pilot with a handful of societies, and the snapshot cache now keeps co-occurrence and trending ordering off the request path. It does **not** yet bound the request-time signal load:

- `/for-you` still reads all open campaigns, all memberships and all quote signals per request and builds the personal peer index in memory. Store per-campaign popularity aggregates in the snapshot and read only the caller's own signals plus its groups' peers before the catalogue grows.
- Trending is global. Add a per-city snapshot scope only when a city's catalogue is large enough for one order to be wrong elsewhere.
- Snapshot rebuild cost grows with signal count; if writes become frequent, move the rebuild to a scheduled job or a queue worker and keep the API read-only.
- Keep the API stateless; do not add a model server until measured latency or model complexity requires it.
- AWS: run the same `infra/api.Dockerfile` on ECS Fargate/App Runner with RDS PostgreSQL; put Next.js on Vercel, Amplify or the same cluster. VM: run both images with `infra/docker-compose.yml` behind a TLS reverse proxy.
- No recommendation writes occur on `GET`; quote signals are best-effort upserts after successful quotes and never block the quote response. Writes also emit no coordinate data.
- The `/for-you` page is dynamic per request; do not add a shared cache without keying by session and invalidating on membership or campaign changes.

## Explicit limits
- Sample campaigns are not real purchases, and `unitsCommitted` is synthetic demand.
- Quote signals are implicit interest, not proof of purchase.
- No A/B testing, fairness audit, explanation evaluation or model monitoring yet.
- Quote signals are deduplicated per member and campaign and rate-limited per member per minute. A distributed attacker with many accounts could still add weak signals; account-level abuse controls and signal ageing are not implemented.
- The rate limiter is per API instance, not shared across replicas.
- Recommendation explanations must stay honest: never claim personalisation that did not run or invent savings.
