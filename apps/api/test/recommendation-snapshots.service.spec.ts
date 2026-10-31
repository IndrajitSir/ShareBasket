import { DataSource, type Repository } from 'typeorm'

import { entities, migrations } from '../src/database/database-options'
import { CampaignSignal } from '../src/database/entities/campaign-signal.entity'
import { Campaign } from '../src/database/entities/campaign.entity'
import { RecommendationSnapshotRow } from '../src/database/entities/recommendation-snapshot.entity'
import { seedDatabase } from '../src/database/seed-runner'
import {
  RecommendationSnapshotsService,
  SNAPSHOT_SCOPE,
} from '../src/recommendations/recommendation-snapshots.service'

const TTL = 60_000

describe('RecommendationSnapshotsService', () => {
  let dataSource: DataSource
  let campaigns: Repository<Campaign>
  let snapshots: Repository<RecommendationSnapshotRow>

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      migrations,
      migrationsRun: true,
      synchronize: false,
    })
    await dataSource.initialize()
    await seedDatabase(dataSource)
    campaigns = dataSource.getRepository(Campaign)
    snapshots = dataSource.getRepository(RecommendationSnapshotRow)
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  function createService(ttlMs = TTL): RecommendationSnapshotsService {
    return new RecommendationSnapshotsService(
      dataSource.getRepository(RecommendationSnapshotRow),
      dataSource.getRepository(Campaign),
      dataSource.getRepository(CampaignSignal),
      ttlMs,
    )
  }

  async function rowCount(): Promise<number> {
    return dataSource.getRepository(RecommendationSnapshotRow).count()
  }

  it('builds and persists once, then serves the in-memory snapshot', async () => {
    const service = createService()
    const findSpy = jest.spyOn(campaigns, 'find')

    const first = await service.get()
    expect(first.trending.length).toBeGreaterThan(0)
    expect(first.campaignCount).toBeGreaterThan(0)
    expect(await rowCount()).toBe(1)

    const callsAfterBuild = findSpy.mock.calls.length
    const second = await service.get()

    expect(second).toEqual(first)
    expect(findSpy.mock.calls.length).toBe(callsAfterBuild)
    expect((await snapshots.findOneOrFail({ where: { scope: SNAPSHOT_SCOPE } })).version).toBe(1)

    service.onModuleDestroy()
    findSpy.mockRestore()
  })

  it('reuses a fresh persisted snapshot after a restart without recomputing', async () => {
    const service = createService()
    const findSpy = jest.spyOn(campaigns, 'find')

    const payload = await service.get()

    expect(payload.trending.length).toBeGreaterThan(0)
    expect(findSpy).not.toHaveBeenCalled()

    service.onModuleDestroy()
    findSpy.mockRestore()
  })

  it('rebuilds and bumps the version after invalidation', async () => {
    const service = createService()
    await service.get()
    const before = await snapshots.findOneOrFail({ where: { scope: SNAPSHOT_SCOPE } })
    const findSpy = jest.spyOn(campaigns, 'find')

    service.invalidate()
    const rebuilt = await service.get()

    expect(findSpy).toHaveBeenCalledTimes(1)
    expect(rebuilt.builtAt).toBeTruthy()
    const after = await snapshots.findOneOrFail({ where: { scope: SNAPSHOT_SCOPE } })
    expect(after.version).toBe(before.version + 1)

    service.onModuleDestroy()
    findSpy.mockRestore()
  })

  it('ignores an expired or corrupt persisted snapshot', async () => {
    const expired = createService(0)
    const findSpy = jest.spyOn(campaigns, 'find')
    await expired.get()
    expect(findSpy).toHaveBeenCalled()
    expired.onModuleDestroy()
    findSpy.mockRestore()

    await dataSource
      .getRepository(RecommendationSnapshotRow)
      .update({ scope: SNAPSHOT_SCOPE }, { payload: 'not-json', computedAt: new Date() })
    const corrupt = createService()
    const corruptSpy = jest.spyOn(campaigns, 'find')
    const rebuilt = await corrupt.get()
    expect(rebuilt.trending.length).toBeGreaterThan(0)
    expect(corruptSpy).toHaveBeenCalled()

    corrupt.onModuleDestroy()
    corruptSpy.mockRestore()
  })
})
