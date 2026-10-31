import { DataSource } from 'typeorm'

import { entities, migrations } from '../src/database/database-options'
import { CampaignSignal } from '../src/database/entities/campaign-signal.entity'
import { Campaign } from '../src/database/entities/campaign.entity'
import { User } from '../src/database/entities/user.entity'
import { seedDatabase } from '../src/database/seed-runner'
import { SlidingWindowRateLimiter } from '../src/recommendations/signal-rate-limit'
import { SignalsService } from '../src/recommendations/signals.service'

describe('SignalsService quote writes', () => {
  let dataSource: DataSource
  let service: SignalsService

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

    service = new SignalsService(
      dataSource.getRepository(CampaignSignal),
      dataSource.getRepository(Campaign),
      new SlidingWindowRateLimiter(2),
    )
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  async function member(email: string): Promise<string> {
    const users = dataSource.getRepository(User)
    const user = await users.save(
      users.create({
        email,
        name: 'Signal Test',
        passwordHash: null,
        avatarUrl: null,
        oauthProvider: 'local',
        oauthSubject: null,
      }),
    )
    return user.id
  }

  async function countFor(userId: string): Promise<number> {
    return dataSource.getRepository(CampaignSignal).count({ where: { userId } })
  }

  it('keeps one signal per campaign and updates its weight', async () => {
    const userId = await member('signals-dedupe@example.com')

    expect(await service.recordQuote(userId, 'filter-coffee', 2)).toBe(true)
    expect(await service.recordQuote(userId, 'filter-coffee', 5)).toBe(true)

    const rows = await dataSource
      .getRepository(CampaignSignal)
      .find({ where: { userId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].weight).toBe(5)
    expect(rows[0].signalType).toBe('QUOTE')
  })

  it('stops recording after the per-member limit and leaves stored rows intact', async () => {
    const userId = await member('signals-limit@example.com')

    expect(await service.recordQuote(userId, 'filter-coffee', 1)).toBe(true)
    expect(await service.recordQuote(userId, 'cold-pressed-oil', 1)).toBe(true)
    expect(await service.recordQuote(userId, 'oat-milk-case', 1)).toBe(false)

    expect(await countFor(userId)).toBe(2)
  })

  it('ignores unknown campaigns without consuming a rate-limit slot', async () => {
    const userId = await member('signals-unknown@example.com')

    expect(await service.recordQuote(userId, 'not-a-campaign', 1)).toBe(false)
    expect(await countFor(userId)).toBe(0)

    expect(await service.recordQuote(userId, 'filter-coffee', 1)).toBe(true)
    expect(await service.recordQuote(userId, 'cold-pressed-oil', 1)).toBe(true)
    expect(await countFor(userId)).toBe(2)
  })
})
