import { DataSource, type Repository } from 'typeorm'

import { entities, migrations } from '../src/database/database-options'
import { CampaignSignal } from '../src/database/entities/campaign-signal.entity'
import { Campaign } from '../src/database/entities/campaign.entity'
import { RecommendationSnapshotRow } from '../src/database/entities/recommendation-snapshot.entity'
import { seedDatabase } from '../src/database/seed-runner'
import {
  rankRecommendations,
  type CandidateCampaign,
  type QuoteSignal,
} from '../src/recommendations/recommendation-engine'
import {
  RecommendationSnapshotsService,
  SNAPSHOT_SCOPE,
} from '../src/recommendations/recommendation-snapshots.service'
import {
  buildRecommendationSnapshot,
  type SnapshotCampaign,
} from '../src/recommendations/recommendation-snapshot'

/**
 * Request-time budgets. They are deliberately loose: the point is to catch a
 * regression from "one cached read" back to "scan every signal per request",
 * not to benchmark the host.
 */
const BUILD_BUDGET_MS = 1_500
const RANK_BUDGET_MS = 750
const WARM_READ_BUDGET_MS = 5
const WARM_READS = 100

const CAMPAIGNS = 800
const MEMBERS = 400
const CLOSES_AT = new Date('2030-01-01T00:00:00.000Z')

function syntheticCatalogue(): { campaigns: SnapshotCampaign[]; signals: QuoteSignal[] } {
  const campaigns: SnapshotCampaign[] = Array.from({ length: CAMPAIGNS }, (_, index) => ({
    slug: `campaign-${index}`,
    unitsCommitted: (index * 37) % 500,
    minimumUnits: 100,
    closesAt: new Date(CLOSES_AT.getTime() + index * 60_000),
  }))

  // Each member quotes three campaigns that share an index bucket, so the
  // co-occurrence graph is dense enough to be realistic but still derivable.
  const signals: QuoteSignal[] = []
  for (let member = 0; member < MEMBERS; member += 1) {
    for (let pick = 0; pick < 3; pick += 1) {
      signals.push({
        userId: `member-${member}`,
        campaignSlug: `campaign-${(member * 7 + pick * 11) % CAMPAIGNS}`,
        weight: 1 + (pick % 3),
      })
    }
  }
  return { campaigns, signals }
}

describe('recommendation latency budgets', () => {
  it('precomputes trending and affinities in one linear pass', () => {
    const { campaigns, signals } = syntheticCatalogue()

    const startedAt = performance.now()
    const snapshot = buildRecommendationSnapshot({
      campaigns,
      signals,
      now: new Date('2026-11-01T00:00:00.000Z'),
    })
    const elapsedMs = performance.now() - startedAt

    expect(snapshot.campaignCount).toBe(CAMPAIGNS)
    expect(snapshot.signalCount).toBe(signals.length)
    expect(snapshot.trending).toHaveLength(50)
    expect(snapshot.affinities.length).toBeGreaterThan(0)
    expect(elapsedMs).toBeLessThan(BUILD_BUDGET_MS)
  })

  it('ranks a large catalogue from precomputed edges instead of re-deriving them', () => {
    const { campaigns, signals } = syntheticCatalogue()
    const now = new Date('2026-11-01T00:00:00.000Z')
    const snapshot = buildRecommendationSnapshot({ campaigns, signals, now })

    const candidates: CandidateCampaign[] = campaigns.map((campaign, index) => ({
      slug: campaign.slug,
      productSlug: `product-${index}`,
      productName: `Product ${index}`,
      categoryKey: 'pantry',
      image: `/products/${index}.svg`,
      societyId: `society-${index % 5}`,
      societyName: `Society ${index % 5}`,
      location: 'Bengaluru',
      unitsCommitted: campaign.unitsCommitted,
      minimumUnits: campaign.minimumUnits,
      closesAt: campaign.closesAt,
      currentUnitPricePaise: 10_000,
    }))

    const startedAt = performance.now()
    const ranked = rankRecommendations({
      userId: 'member-1',
      userSocietyIds: ['society-0'],
      candidates,
      memberships: [{ userId: 'member-1', societyId: 'society-0' }],
      signals,
      now,
      affinities: snapshot.affinities,
      trendingOrder: snapshot.trending,
    })
    const elapsedMs = performance.now() - startedAt

    expect(ranked.inYourGroups.length).toBeGreaterThan(0)
    expect(ranked.trending).toHaveLength(6)
    expect(elapsedMs).toBeLessThan(RANK_BUDGET_MS)
  })

  it('serves warm snapshots from memory without touching the database', async () => {
    const dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      migrations,
      migrationsRun: true,
      synchronize: false,
    })
    await dataSource.initialize()

    const snapshots: Repository<RecommendationSnapshotRow> = dataSource.getRepository(
      RecommendationSnapshotRow,
    )
    const campaigns: Repository<Campaign> = dataSource.getRepository(Campaign)
    const signals: Repository<CampaignSignal> = dataSource.getRepository(CampaignSignal)

    try {
      await seedDatabase(dataSource)
      const service = new RecommendationSnapshotsService(snapshots, campaigns, signals, 60_000)
      const first = await service.refreshNow()

      const findSpy = jest.spyOn(campaigns, 'find')
      const rowSpy = jest.spyOn(snapshots, 'findOne')

      const startedAt = performance.now()
      for (let read = 0; read < WARM_READS; read += 1) {
        expect(await service.get()).toBe(first)
      }
      const averageMs = (performance.now() - startedAt) / WARM_READS

      expect(findSpy).not.toHaveBeenCalled()
      expect(rowSpy).not.toHaveBeenCalled()
      expect(averageMs).toBeLessThan(WARM_READ_BUDGET_MS)

      // Invalidation drops the cache and the next read rebuilds exactly once.
      service.invalidate()
      await service.get()
      await service.get()
      expect((await snapshots.findOneOrFail({ where: { scope: SNAPSHOT_SCOPE } })).version).toBe(2)

      service.onModuleDestroy()
      findSpy.mockRestore()
      rowSpy.mockRestore()
    } finally {
      await dataSource.destroy()
    }
  })
})
