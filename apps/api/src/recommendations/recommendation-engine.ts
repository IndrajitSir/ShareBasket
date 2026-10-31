/**
 * Explainable hybrid ranking. Pure functions only: no persistence, HTTP, clock
 * or randomness leaks in, which keeps the model deterministic and unit-testable.
 *
 * Inputs are implicit interest (quotes) and aggregate campaign demand, never
 * purchases. See docs/RECOMMENDATIONS.md for the model contract.
 */

export type RecommendationSource = 'YOUR_GROUPS' | 'OTHER_GROUPS' | 'TRENDING'

export interface CandidateCampaign {
  slug: string
  productSlug: string
  productName: string
  categoryKey: string
  image: string
  societyId: string
  societyName: string
  location: string
  unitsCommitted: number
  minimumUnits: number
  closesAt: Date
  currentUnitPricePaise: number
}

export interface QuoteSignal {
  userId: string
  campaignSlug: string
  weight: number
}

export interface MembershipRow {
  userId: string
  societyId: string
}

export interface RecommendationItem {
  campaign: CandidateCampaign
  source: RecommendationSource
  reason: string
  score: number
}

export interface RankingResult {
  inYourGroups: RecommendationItem[]
  otherGroups: RecommendationItem[]
  trending: RecommendationItem[]
}

export interface RankingInput {
  userId: string | null
  userSocietyIds: string[]
  candidates: CandidateCampaign[]
  memberships: MembershipRow[]
  signals: QuoteSignal[]
  now: Date
  limit?: number
}

const DEFAULT_LIMIT = 6
const MAX_DAYS_FOR_URGENCY = 14

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function cityOf(location: string): string {
  return location.split('·')[0]?.trim().toLowerCase() ?? ''
}

function demandScore(campaign: CandidateCampaign): number {
  if (!Number.isFinite(campaign.minimumUnits) || campaign.minimumUnits < 1) return 0
  return clamp(campaign.unitsCommitted / campaign.minimumUnits)
}

function urgencyScore(campaign: CandidateCampaign, now: Date): number {
  const days = (campaign.closesAt.getTime() - now.getTime()) / 86_400_000
  if (days <= 0) return 0
  return clamp(1 - days / MAX_DAYS_FOR_URGENCY)
}

function tierDemand(campaigns: CandidateCampaign[]): Map<string, number> {
  return new Map(campaigns.map((campaign) => [campaign.slug, demandScore(campaign)]))
}

interface SignalIndex {
  usersByCampaign: Map<string, Set<string>>
  weightedByCampaign: Map<string, number>
  campaignsByUser: Map<string, Set<string>>
}

function indexSignals(signals: QuoteSignal[], excludedUserId: string | null): SignalIndex {
  const usersByCampaign = new Map<string, Set<string>>()
  const weightedByCampaign = new Map<string, number>()
  const campaignsByUser = new Map<string, Set<string>>()

  for (const signal of signals) {
    if (excludedUserId && signal.userId === excludedUserId) continue
    const users = usersByCampaign.get(signal.campaignSlug) ?? new Set<string>()
    users.add(signal.userId)
    usersByCampaign.set(signal.campaignSlug, users)

    const weight = Number.isFinite(signal.weight) ? Math.max(1, signal.weight) : 1
    weightedByCampaign.set(
      signal.campaignSlug,
      (weightedByCampaign.get(signal.campaignSlug) ?? 0) + weight,
    )

    const campaigns = campaignsByUser.get(signal.userId) ?? new Set<string>()
    campaigns.add(signal.campaignSlug)
    campaignsByUser.set(signal.userId, campaigns)
  }

  return { usersByCampaign, weightedByCampaign, campaignsByUser }
}

function cosineSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  for (const value of left) {
    if (right.has(value)) intersection += 1
  }
  return intersection / Math.sqrt(left.size * right.size)
}

function affinityScore(
  campaignSlug: string,
  ownCampaignSlugs: string[],
  index: SignalIndex,
): number {
  if (ownCampaignSlugs.length === 0) return 0
  const candidateUsers = index.usersByCampaign.get(campaignSlug)
  if (!candidateUsers) return 0

  let total = 0
  for (const ownSlug of ownCampaignSlugs) {
    const ownUsers = index.usersByCampaign.get(ownSlug)
    if (ownUsers) total += cosineSimilarity(candidateUsers, ownUsers)
  }
  return total / ownCampaignSlugs.length
}

function reasonFor(
  campaign: CandidateCampaign,
  source: RecommendationSource,
  peerCount: number,
  demand: number,
): string {
  const society = campaign.societyName
  if (source === 'YOUR_GROUPS') {
    if (peerCount > 0) {
      return `${peerCount} ${peerCount === 1 ? 'neighbour has' : 'neighbours have'} quoted this`
    }
    if (demand >= 1) return `Minimum met in ${society}`
    return `${campaign.unitsCommitted} units pledged in ${society}`
  }
  if (source === 'OTHER_GROUPS') {
    if (peerCount > 0) {
      return `${peerCount} ${peerCount === 1 ? 'neighbour has' : 'neighbours have'} quoted this`
    }
    if (demand >= 1) return `Minimum met in ${society}`
    return `${campaign.unitsCommitted} units pledged in ${society}`
  }
  return demand >= 1 ? `Minimum met in ${society}` : `Trending in ${society}`
}

interface Scored extends RecommendationItem {
  productSlug: string
}

function rank(
  candidates: CandidateCampaign[],
  source: RecommendationSource,
  scoreOf: (campaign: CandidateCampaign) => number,
  reasonOf: (campaign: CandidateCampaign) => string,
): Scored[] {
  return candidates
    .map((campaign) => ({
      campaign,
      source,
      reason: reasonOf(campaign),
      score: Math.round(scoreOf(campaign) * 10_000) / 10_000,
      productSlug: campaign.productSlug,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.campaign.closesAt.getTime() - right.campaign.closesAt.getTime() ||
        left.campaign.slug.localeCompare(right.campaign.slug),
    )
}

function takeUnique(items: Scored[], limit: number, usedProducts: Set<string>): RecommendationItem[] {
  const picked: RecommendationItem[] = []
  for (const item of items) {
    if (usedProducts.has(item.productSlug)) continue
    usedProducts.add(item.productSlug)
    picked.push({
      campaign: item.campaign,
      source: item.source,
      reason: item.reason,
      score: item.score,
    })
    if (picked.length === limit) break
  }
  return picked
}

/**
 * Ranks in-group, other-group and trending recommendations. The user's own
 * quoted campaigns are excluded so the page does not just repeat their intent.
 */
export function rankRecommendations(input: RankingInput): RankingResult {
  const limit = input.limit ?? DEFAULT_LIMIT
  const open = input.candidates.filter(
    (campaign) =>
      campaign.closesAt.getTime() > input.now.getTime() &&
      Number.isFinite(campaign.unitsCommitted) &&
      Number.isFinite(campaign.minimumUnits),
  )

  const ownCampaignSlugs = Array.from(
    new Set(
      input.signals
        .filter((signal) => signal.userId === input.userId)
        .map((signal) => signal.campaignSlug),
    ),
  )
  const ownSet = new Set(ownCampaignSlugs)
  const candidates = input.userId ? open.filter((campaign) => !ownSet.has(campaign.slug)) : open

  const userSocietyIds = new Set(input.userSocietyIds)
  const peerIds = new Set(
    input.memberships
      .filter((membership) => userSocietyIds.has(membership.societyId))
      .map((membership) => membership.userId),
  )
  if (input.userId) peerIds.delete(input.userId)

  const allIndex = indexSignals(input.signals, input.userId)
  const peerIndex = indexSignals(
    input.signals.filter((signal) => peerIds.has(signal.userId)),
    input.userId,
  )

  const groupLocations = new Map(
    open.map((campaign) => [campaign.societyId, cityOf(campaign.location)]),
  )
  const homeCities = new Set(
    Array.from(userSocietyIds)
      .map((societyId) => groupLocations.get(societyId))
      .filter((city): city is string => Boolean(city)),
  )

  const inGroup = candidates.filter((campaign) => userSocietyIds.has(campaign.societyId))
  const other = userSocietyIds.size
    ? candidates.filter((campaign) => !userSocietyIds.has(campaign.societyId))
    : []
  const trendingPool = candidates

  const demandBySlug = tierDemand(candidates)
  const peerWeightBySlug = peerIndex.weightedByCampaign
  const maxPeerWeight = Math.max(1, ...Array.from(peerWeightBySlug.values()))
  const peerCountBySlug = new Map<string, number>()
  for (const [slug, users] of peerIndex.usersByCampaign.entries()) {
    peerCountBySlug.set(slug, users.size)
  }

  const affinityBySlug = new Map(
    candidates.map((campaign) => [
      campaign.slug,
      affinityScore(campaign.slug, ownCampaignSlugs, allIndex),
    ]),
  )
  const maxAffinity = Math.max(0, ...Array.from(affinityBySlug.values())) || 1

  const inGroupRanked = rank(
    inGroup,
    'YOUR_GROUPS',
    (campaign) => {
      const demand = demandBySlug.get(campaign.slug) ?? 0
      const peer = (peerWeightBySlug.get(campaign.slug) ?? 0) / maxPeerWeight
      const affinity = (affinityBySlug.get(campaign.slug) ?? 0) / maxAffinity
      return 0.45 * demand + 0.35 * peer + 0.15 * affinity + 0.05 * urgencyScore(campaign, input.now)
    },
    (campaign) =>
      reasonFor(
        campaign,
        'YOUR_GROUPS',
        peerCountBySlug.get(campaign.slug) ?? 0,
        demandBySlug.get(campaign.slug) ?? 0,
      ),
  )

  const otherRanked = rank(
    other,
    'OTHER_GROUPS',
    (campaign) => {
      const demand = demandBySlug.get(campaign.slug) ?? 0
      const affinity = (affinityBySlug.get(campaign.slug) ?? 0) / maxAffinity
      const sameCity = homeCities.has(cityOf(campaign.location)) ? 1 : 0
      return (
        0.55 * demand + 0.25 * affinity + 0.15 * urgencyScore(campaign, input.now) + 0.05 * sameCity
      )
    },
    (campaign) =>
      reasonFor(
        campaign,
        'OTHER_GROUPS',
        peerCountBySlug.get(campaign.slug) ?? 0,
        demandBySlug.get(campaign.slug) ?? 0,
      ),
  )

  const trendingRanked = rank(
    trendingPool,
    'TRENDING',
    (campaign) =>
      0.85 * (demandBySlug.get(campaign.slug) ?? 0) + 0.15 * urgencyScore(campaign, input.now),
    (campaign) =>
      reasonFor(campaign, 'TRENDING', 0, demandBySlug.get(campaign.slug) ?? 0),
  )

  // If the user has no groups, do not invent an "other groups" section.
  const used = new Set<string>()
  const result: RankingResult = {
    inYourGroups: userSocietyIds.size ? takeUnique(inGroupRanked, limit, used) : [],
    otherGroups: userSocietyIds.size ? takeUnique(otherRanked, limit, used) : [],
    trending: takeUnique(trendingRanked, limit, used),
  }

  return result
}
