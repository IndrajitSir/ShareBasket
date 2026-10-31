import { haversineKm, roundDistanceKm } from '../src/recommendations/geo'
import {
  rankRecommendations,
  type CandidateCampaign,
  type MembershipRow,
  type QuoteSignal,
} from '../src/recommendations/recommendation-engine'

const NOW = new Date('2026-10-31T00:00:00Z')
const DAY = 86_400_000

function campaign(overrides: Partial<CandidateCampaign> & { slug: string }): CandidateCampaign {
  return {
    slug: overrides.slug,
    productSlug: overrides.productSlug ?? `${overrides.slug}-product`,
    productName: overrides.productName ?? overrides.slug,
    categoryKey: overrides.categoryKey ?? 'pantry',
    image: '/images/rice.svg',
    societyId: overrides.societyId ?? 'society-1',
    societyName: overrides.societyName ?? 'Maple Residency',
    location: overrides.location ?? 'Bengaluru · Whitefield',
    unitsCommitted: overrides.unitsCommitted ?? 10,
    minimumUnits: overrides.minimumUnits ?? 100,
    closesAt: overrides.closesAt ?? new Date(NOW.getTime() + 5 * DAY),
    currentUnitPricePaise: 28900,
  }
}

function membership(userId: string, societyId: string): MembershipRow {
  return { userId, societyId }
}

function signal(userId: string, campaignSlug: string, weight = 1): QuoteSignal {
  return { userId, campaignSlug, weight }
}

describe('rankRecommendations', () => {
  it('falls back to demand-ranked trending with no user or groups', () => {
    const result = rankRecommendations({
      userId: null,
      userSocietyIds: [],
      candidates: [
        campaign({ slug: 'low', unitsCommitted: 10, minimumUnits: 100 }),
        campaign({ slug: 'high', unitsCommitted: 90, minimumUnits: 100 }),
      ],
      memberships: [],
      signals: [],
      now: NOW,
    })

    expect(result.inYourGroups).toEqual([])
    expect(result.otherGroups).toEqual([])
    expect(result.trending.map((item) => item.campaign.slug)).toEqual(['high', 'low'])
    expect(result.trending[0].reason).toBe('Trending in Maple Residency')
  })

  it('shows cross-group picks to a signed-in member with no groups', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: [],
      candidates: [
        campaign({ slug: 'a', societyId: 'society-2', unitsCommitted: 80, minimumUnits: 100 }),
        campaign({ slug: 'b', societyId: 'society-3', unitsCommitted: 20, minimumUnits: 100 }),
      ],
      memberships: [],
      signals: [],
      now: NOW,
    })

    expect(result.inYourGroups).toEqual([])
    expect(result.otherGroups.map((item) => item.campaign.slug)).toEqual(['a', 'b'])
    expect(result.otherGroups[0].source).toBe('OTHER_GROUPS')
  })

  it('promotes what peers in the user groups quoted', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [
        campaign({ slug: 'quiet', unitsCommitted: 80, minimumUnits: 100 }),
        campaign({ slug: 'peers', unitsCommitted: 20, minimumUnits: 100 }),
      ],
      memberships: [
        membership('user-1', 'society-1'),
        membership('user-2', 'society-1'),
        membership('user-3', 'society-1'),
      ],
      signals: [signal('user-2', 'peers'), signal('user-3', 'peers')],
      now: NOW,
    })

    expect(result.inYourGroups[0].campaign.slug).toBe('peers')
    expect(result.inYourGroups[0].reason).toBe('2 neighbours have quoted this')
    expect(result.inYourGroups[1].campaign.slug).toBe('quiet')
  })

  it('excludes campaigns the current user already quoted', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [campaign({ slug: 'already-quoted' }), campaign({ slug: 'fresh' })],
      memberships: [membership('user-1', 'society-1')],
      signals: [signal('user-1', 'already-quoted', 4)],
      now: NOW,
    })

    const all = [...result.inYourGroups, ...result.otherGroups, ...result.trending]
    expect(all.map((item) => item.campaign.slug)).not.toContain('already-quoted')
    expect(result.inYourGroups[0].campaign.slug).toBe('fresh')
  })

  it('separates other groups and boosts same-city campaigns', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [
        campaign({ slug: 'home', societyId: 'society-1', unitsCommitted: 20 }),
        campaign({
          slug: 'same-city',
          societyId: 'society-2',
          location: 'Bengaluru · Bellandur',
          unitsCommitted: 40,
        }),
        campaign({
          slug: 'other-city',
          societyId: 'society-3',
          location: 'Mumbai · Bandra',
          unitsCommitted: 42,
        }),
      ],
      memberships: [membership('user-1', 'society-1')],
      signals: [],
      now: NOW,
    })

    expect(result.inYourGroups.map((item) => item.campaign.slug)).toEqual(['home'])
    expect(result.otherGroups.map((item) => item.campaign.slug)).toEqual(['same-city', 'other-city'])
    expect(result.otherGroups[0].source).toBe('OTHER_GROUPS')
  })

  it('ranks campaigns with stronger co-quote affinity first', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [
        campaign({ slug: 'affine', societyId: 'society-2', unitsCommitted: 50 }),
        campaign({ slug: 'unrelated', societyId: 'society-2', unitsCommitted: 50 }),
      ],
      memberships: [membership('user-1', 'society-1')],
      signals: [
        signal('user-1', 'own-campaign'),
        signal('user-2', 'own-campaign'),
        signal('user-3', 'own-campaign'),
        signal('user-2', 'affine'),
        signal('user-3', 'affine'),
        signal('user-4', 'unrelated'),
      ],
      now: NOW,
    })

    expect(result.otherGroups[0].campaign.slug).toBe('affine')
  })

  it('keeps sooner-closing campaigns ahead when demand is equal', () => {
    const result = rankRecommendations({
      userId: null,
      userSocietyIds: [],
      candidates: [
        campaign({ slug: 'later', closesAt: new Date(NOW.getTime() + 10 * DAY) }),
        campaign({ slug: 'sooner', closesAt: new Date(NOW.getTime() + 2 * DAY) }),
      ],
      memberships: [],
      signals: [],
      now: NOW,
    })

    expect(result.trending[0].campaign.slug).toBe('sooner')
  })

  it('limits sections and never repeats a product across sections', () => {
    const result = rankRecommendations({
      userId: 'user-1',
      userSocietyIds: ['society-1'],
      candidates: [
        campaign({ slug: 'home-a', productSlug: 'shared', societyId: 'society-1', unitsCommitted: 90 }),
        campaign({ slug: 'other-a', productSlug: 'shared', societyId: 'society-2' }),
        campaign({ slug: 'home-b', productSlug: 'b', societyId: 'society-1', unitsCommitted: 80 }),
        campaign({ slug: 'home-c', productSlug: 'c', societyId: 'society-1', unitsCommitted: 70 }),
      ],
      memberships: [membership('user-1', 'society-1')],
      signals: [],
      now: NOW,
      limit: 2,
    })

    expect(result.inYourGroups).toHaveLength(2)
    expect(result.inYourGroups.map((item) => item.campaign.slug)).toEqual(['home-a', 'home-b'])
    expect(result.otherGroups.map((item) => item.campaign.slug)).not.toContain('other-a')
    const products = [...result.inYourGroups, ...result.otherGroups, ...result.trending].map(
      (item) => item.campaign.productSlug,
    )
    expect(new Set(products).size).toBe(products.length)
  })
})

describe('haversineKm', () => {
  const whitefield = { latitude: 12.9698, longitude: 77.75 }
  const bellandur = { latitude: 12.925, longitude: 77.676 }

  it('is zero for the same point and uses kilometres', () => {
    expect(haversineKm(whitefield, whitefield)).toBe(0)
    const distance = haversineKm(whitefield, bellandur)
    expect(distance).toBeGreaterThan(5)
    expect(distance).toBeLessThan(15)
    expect(roundDistanceKm(distance)).toBe(Math.round(distance * 10) / 10)
  })
})
