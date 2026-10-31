import {
  demandScore,
  urgencyScore,
  type AffinityEdge,
  type QuoteSignal,
} from './recommendation-engine'

/**
 * Precomputed, session-independent recommendation data. Only open campaigns and
 * implicit quote signals feed it, so it can be shared by every visitor and
 * rebuilt in the background whenever a signal is written.
 */
export interface SnapshotCampaign {
  slug: string
  unitsCommitted: number
  minimumUnits: number
  closesAt: Date
}

export interface RecommendationSnapshotPayload {
  schemaVersion: 1
  builtAt: string
  campaignCount: number
  signalCount: number
  /** Campaign slugs in anonymous trending order. */
  trending: string[]
  /** Symmetric item-item cosine similarity over quoting users. */
  affinities: AffinityEdge[]
}

export interface BuildSnapshotInput {
  campaigns: SnapshotCampaign[]
  signals: QuoteSignal[]
  now: Date
  trendingLimit?: number
  affinityLimit?: number
}

const TRENDING_LIMIT = 50
const AFFINITY_LIMIT = 10

function pairKey(left: string, right: string): string {
  return `${left}\u0000${right}`
}

/**
 * Deterministic and cheap for a pilot catalogue: one pass over signals builds
 * both the co-quote counts and the trending order. No persistence, HTTP or
 * randomness, so it can be unit-tested and run in-process on any host.
 */
export function buildRecommendationSnapshot(input: BuildSnapshotInput): RecommendationSnapshotPayload {
  const trendingLimit = input.trendingLimit ?? TRENDING_LIMIT
  const affinityLimit = input.affinityLimit ?? AFFINITY_LIMIT
  const open = input.campaigns.filter(
    (campaign) =>
      campaign.closesAt.getTime() > input.now.getTime() &&
      Number.isFinite(campaign.unitsCommitted) &&
      Number.isFinite(campaign.minimumUnits),
  )
  const openSlugs = new Set(open.map((campaign) => campaign.slug))

  const trending = open
    .map((campaign) => ({
      slug: campaign.slug,
      score: 0.85 * demandScore(campaign) + 0.15 * urgencyScore(campaign, input.now),
      closesAt: campaign.closesAt.getTime(),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.closesAt - right.closesAt ||
        left.slug.localeCompare(right.slug),
    )
    .slice(0, trendingLimit)
    .map((item) => item.slug)

  // Campaign -> users and user -> campaigns, restricted to open campaigns so a
  // closed campaign's old quotes cannot leak into current affinity.
  const usersByCampaign = new Map<string, Set<string>>()
  const campaignsByUser = new Map<string, Set<string>>()
  let signalCount = 0
  for (const signal of input.signals) {
    if (!openSlugs.has(signal.campaignSlug)) continue
    signalCount += 1
    const users = usersByCampaign.get(signal.campaignSlug) ?? new Set<string>()
    users.add(signal.userId)
    usersByCampaign.set(signal.campaignSlug, users)

    const campaigns = campaignsByUser.get(signal.userId) ?? new Set<string>()
    campaigns.add(signal.campaignSlug)
    campaignsByUser.set(signal.userId, campaigns)
  }

  // One pass over each member's quoted campaigns counts every unordered pair.
  const coQuotes = new Map<string, number>()
  for (const campaigns of campaignsByUser.values()) {
    const slugs = Array.from(campaigns).sort()
    for (let left = 0; left < slugs.length; left += 1) {
      for (let right = left + 1; right < slugs.length; right += 1) {
        const key = pairKey(slugs[left], slugs[right])
        coQuotes.set(key, (coQuotes.get(key) ?? 0) + 1)
      }
    }
  }

  const edges: AffinityEdge[] = []
  for (const [campaignSlug, users] of usersByCampaign) {
    const related: AffinityEdge[] = []
    for (const [otherSlug, otherUsers] of usersByCampaign) {
      if (otherSlug === campaignSlug) continue
      const key =
        campaignSlug < otherSlug ? pairKey(campaignSlug, otherSlug) : pairKey(otherSlug, campaignSlug)
      const shared = coQuotes.get(key) ?? 0
      if (shared === 0) continue
      const score = shared / Math.sqrt(users.size * otherUsers.size)
      related.push({ campaignSlug, relatedSlug: otherSlug, score: Math.round(score * 10_000) / 10_000 })
    }
    related.sort(
      (left, right) =>
        right.score - left.score || left.relatedSlug.localeCompare(right.relatedSlug),
    )
    edges.push(...related.slice(0, affinityLimit))
  }

  return {
    schemaVersion: 1,
    builtAt: input.now.toISOString(),
    campaignCount: open.length,
    signalCount,
    trending,
    affinities: edges,
  }
}
