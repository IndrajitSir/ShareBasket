import {
  buildRecommendationSnapshot,
  type SnapshotCampaign,
} from '../src/recommendations/recommendation-snapshot'
import {
  rankRecommendations,
  type AffinityEdge,
  type CandidateCampaign,
} from '../src/recommendations/recommendation-engine'

const NOW = new Date('2026-10-31T00:00:00Z')
const DAY = 86_400_000

function snapshotCampaign(
  slug: string,
  overrides: Partial<SnapshotCampaign> = {},
): SnapshotCampaign {
  return {
    slug,
    unitsCommitted: overrides.unitsCommitted ?? 10,
    minimumUnits: overrides.minimumUnits ?? 100,
    closesAt: overrides.closesAt ?? new Date(NOW.getTime() + 5 * DAY),
  }
}

function candidate(slug: string, overrides: Partial<CandidateCampaign> = {}): CandidateCampaign {
  return {
    slug,
    productSlug: overrides.productSlug ?? `${slug}-product`,
    productName: slug,
    categoryKey: 'pantry',
    image: '/images/rice.svg',
    societyId: overrides.societyId ?? 'society-1',
    societyName: 'Maple Residency',
    location: 'Bengaluru · Whitefield',
    unitsCommitted: overrides.unitsCommitted ?? 10,
    minimumUnits: overrides.minimumUnits ?? 100,
    closesAt: overrides.closesAt ?? new Date(NOW.getTime() + 5 * DAY),
    currentUnitPricePaise: 28900,
  }
}

describe('buildRecommendationSnapshot', () => {
  it('orders open campaigns by demand and urgency and drops closed ones', () => {
    const snapshot = buildRecommendationSnapshot({
      campaigns: [
        snapshotCampaign('low', { unitsCommitted: 10 }),
        snapshotCampaign('high', { unitsCommitted: 90 }),
        snapshotCampaign('closed', { unitsCommitted: 100, closesAt: new Date(NOW.getTime() - DAY) }),
      ],
      signals: [],
      now: NOW,
    })

    expect(snapshot.trending).toEqual(['high', 'low'])
    expect(snapshot.campaignCount).toBe(2)
    expect(snapshot.schemaVersion).toBe(1)
  })

  it('computes symmetric item-item cosine affinity from shared quoting users', () => {
    const snapshot = buildRecommendationSnapshot({
      campaigns: [snapshotCampaign('a'), snapshotCampaign('b'), snapshotCampaign('c')],
      signals: [
        { userId: 'u1', campaignSlug: 'a', weight: 1 },
        { userId: 'u1', campaignSlug: 'b', weight: 1 },
        { userId: 'u2', campaignSlug: 'a', weight: 1 },
        { userId: 'u2', campaignSlug: 'b', weight: 1 },
        { userId: 'u3', campaignSlug: 'a', weight: 1 },
      ],
      now: NOW,
    })

    const forward = snapshot.affinities.find(
      (edge) => edge.campaignSlug === 'a' && edge.relatedSlug === 'b',
    )
    const reverse = snapshot.affinities.find(
      (edge) => edge.campaignSlug === 'b' && edge.relatedSlug === 'a',
    )
    expect(forward?.score).toBe(0.8165)
    expect(reverse?.score).toBe(forward?.score)
    expect(
      snapshot.affinities.some((edge) => edge.relatedSlug === 'c' || edge.campaignSlug === 'c'),
    ).toBe(false)
    expect(snapshot.signalCount).toBe(5)
  })

  it('ignores signals for closed campaigns and caps affinity edges deterministically', () => {
    const snapshot = buildRecommendationSnapshot({
      campaigns: [snapshotCampaign('a'), snapshotCampaign('b'), snapshotCampaign('c')],
      signals: [
        { userId: 'u1', campaignSlug: 'a', weight: 1 },
        { userId: 'u1', campaignSlug: 'b', weight: 1 },
        { userId: 'u1', campaignSlug: 'c', weight: 1 },
        { userId: 'u2', campaignSlug: 'a', weight: 1 },
        { userId: 'u2', campaignSlug: 'closed', weight: 1 },
      ],
      now: NOW,
      affinityLimit: 1,
    })

    const fromA = snapshot.affinities.filter((edge) => edge.campaignSlug === 'a')
    expect(fromA).toHaveLength(1)
    expect(fromA[0].relatedSlug).toBe('b')
    expect(snapshot.signalCount).toBe(4)
  })
})

describe('rankRecommendations precomputed inputs', () => {
  it('follows the snapshot trending order and keeps unlisted campaigns after it', () => {
    const result = rankRecommendations({
      userId: null,
      userSocietyIds: [],
      candidates: [candidate('a', { unitsCommitted: 90 }), candidate('b', { unitsCommitted: 10 })],
      memberships: [],
      signals: [],
      now: NOW,
      trendingOrder: ['b'],
    })

    expect(result.trending.map((item) => item.campaign.slug)).toEqual(['b', 'a'])
  })

  it('uses precomputed affinities instead of scanning co-quote signals', () => {
    const affinities: AffinityEdge[] = [
      { campaignSlug: 'affine', relatedSlug: 'own', score: 0.9 },
      { campaignSlug: 'unrelated', relatedSlug: 'own', score: 0.1 },
    ]
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [
        candidate('affine', { societyId: 'society-2', unitsCommitted: 50 }),
        candidate('unrelated', { societyId: 'society-2', unitsCommitted: 50 }),
      ],
      memberships: [{ userId: 'user-1', societyId: 'society-1' }],
      signals: [{ userId: 'user-1', campaignSlug: 'own', weight: 1 }],
      now: NOW,
      affinities,
    })

    expect(result.otherGroups.map((item) => item.campaign.slug)).toEqual([
      'affine',
      'unrelated',
    ])
  })
})
