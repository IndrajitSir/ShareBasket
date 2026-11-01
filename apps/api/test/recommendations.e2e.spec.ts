import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { DataSource, Repository } from 'typeorm'

import { configureApp } from '../src/app.setup'
import { AuthModule } from '../src/auth/auth.module'
import { CampaignsModule } from '../src/campaigns/campaigns.module'
import { entities, migrations } from '../src/database/database-options'
import { CampaignSignal } from '../src/database/entities/campaign-signal.entity'
import { Campaign } from '../src/database/entities/campaign.entity'
import { Society } from '../src/database/entities/society.entity'
import { seedDatabase } from '../src/database/seed-runner'
import { MembershipsModule } from '../src/memberships/memberships.module'
import { RecommendationsModule } from '../src/recommendations/recommendations.module'

const MAPLE = 'Maple Residency'
const LAKEVIEW = 'Lakeview Enclave'

describe('Recommendations API (SQLite, migrated schema)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let signals: Repository<CampaignSignal>
  let campaigns: Repository<Campaign>
  let mapleId: string
  let mapleSteward: ReturnType<typeof request.agent>
  let lakeviewId: string
  let server: ReturnType<INestApplication['getHttpServer']>

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-session-secret-at-least-32-characters'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities,
          migrations,
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 0,
        }),
        AuthModule,
        MembershipsModule,
        RecommendationsModule,
        CampaignsModule,
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, { corsOrigins: ['http://localhost:3001'] })
    await app.init()
    server = app.getHttpServer()
    dataSource = app.get(DataSource)
    await seedDatabase(dataSource)
    signals = dataSource.getRepository(CampaignSignal)
    campaigns = dataSource.getRepository(Campaign)

    const societies = await dataSource.getRepository(Society).find()
    mapleId = societies.find((society) => society.name === MAPLE)!.id
    lakeviewId = societies.find((society) => society.name === LAKEVIEW)!.id
  })

  afterAll(async () => {
    await app.close()
  })

  async function register(email: string) {
    const agent = request.agent(server)
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse', name: 'Recommendation Test' })
      .expect(201)
    return agent
  }

  async function waitForSignals(expected: number): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if ((await signals.count()) >= expected) return
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    throw new Error(`Expected at least ${expected} recorded quote signals.`)
  }

  it('serves demand-ranked trending to signed-out visitors', async () => {
    const response = await request(server).get('/api/v1/recommendations/for-you').expect(200)

    expect(response.body.signedIn).toBe(false)
    expect(response.body.personalized).toBe(false)
    expect(response.body.needsGroup).toBe(false)
    expect(response.body.groups).toEqual([])
    expect(response.body.sections.inYourGroups).toEqual([])
    expect(response.body.sections.otherGroups).toEqual([])
    expect(response.body.sections.trending.length).toBeGreaterThan(0)
    expect(response.body.sections.trending[0]).toMatchObject({
      source: 'TRENDING',
    })
    expect(response.body.sections.trending[0].currentUnitPrice).toMatch(/₹/)
    expect(response.body.model.name).toBe('hybrid-demand-cf')
  })

  it('asks a signed-in member without groups to find one, and only then for location', async () => {
    const agent = await register('recommend-no-group@example.com')
    const response = await agent.get('/api/v1/recommendations/for-you').expect(200)

    expect(response.body.signedIn).toBe(true)
    expect(response.body.personalized).toBe(false)
    expect(response.body.needsGroup).toBe(true)
    expect(response.body.needsLocation).toBe(true)
    expect(response.body.groups).toEqual([])
    expect(response.body.sections.inYourGroups).toEqual([])
    expect(response.body.sections.otherGroups.length).toBeGreaterThan(0)
    expect(response.body.sections.otherGroups[0].source).toBe('OTHER_GROUPS')
    expect(response.body.sections.trending.length).toBeGreaterThan(0)
  })

  it('personalises different sections after joining a group', async () => {
    const agent = await register('recommend-member@example.com')
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    mapleSteward = agent

    const response = await agent.get('/api/v1/recommendations/for-you').expect(200)

    expect(response.body.personalized).toBe(true)
    expect(response.body.needsGroup).toBe(false)
    expect(response.body.needsLocation).toBe(false)
    expect(response.body.groups).toHaveLength(1)
    expect(response.body.groups[0].id).toBe(mapleId)
    expect(response.body.sections.inYourGroups.length).toBeGreaterThan(0)
    expect(
      response.body.sections.inYourGroups.every(
        (item: { society: { id: string } }) => item.society.id === mapleId,
      ),
    ).toBe(true)
    expect(
      response.body.sections.otherGroups.every(
        (item: { society: { id: string } }) => item.society.id !== mapleId,
      ),
    ).toBe(true)
    expect(
      response.body.sections.inYourGroups.every(
        (item: { reason: string; source: string }) =>
          item.source === 'YOUR_GROUPS' && item.reason.length > 0,
      ),
    ).toBe(true)
  })

  it('keeps a pending request out of personal recommendations until it is approved', async () => {
    const agent = await register('recommend-pending@example.com')
    const joined = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(joined.body.group.status).toBe('PENDING')

    const pending = await agent.get('/api/v1/recommendations/for-you').expect(200)
    expect(pending.body.personalized).toBe(false)
    expect(pending.body.needsGroup).toBe(true)
    expect(pending.body.groups).toEqual([
      expect.objectContaining({ id: mapleId, status: 'PENDING' }),
    ])
    expect(pending.body.sections.inYourGroups).toEqual([])

    const agentId = (await agent.get('/api/v1/auth/me').expect(200)).body.user.id as string
    await mapleSteward
      .post(`/api/v1/societies/${mapleId}/requests/${agentId}/approve`)
      .expect(200)

    const approved = await agent.get('/api/v1/recommendations/for-you').expect(200)
    expect(approved.body.personalized).toBe(true)
    expect(approved.body.needsGroup).toBe(false)
    expect(approved.body.groups[0]).toMatchObject({ id: mapleId, status: 'ACTIVE' })
    expect(approved.body.sections.inYourGroups.length).toBeGreaterThan(0)
  })

  it('records quotes as implicit signals and explains peer-driven suggestions', async () => {
    const viewer = await register('recommend-viewer@example.com')
    const viewerId = (await viewer.get('/api/v1/auth/me').expect(200)).body.user.id as string
    await viewer.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await mapleSteward
      .post(`/api/v1/societies/${mapleId}/requests/${viewerId}/approve`)
      .expect(200)

    const peer = await register('recommend-peer@example.com')
    const peerId = (await peer.get('/api/v1/auth/me').expect(200)).body.user.id as string
    await peer.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await mapleSteward
      .post(`/api/v1/societies/${mapleId}/requests/${peerId}/approve`)
      .expect(200)
    await peer
      .post('/api/v1/campaigns/filter-coffee/quote')
      .send({ quantity: 3 })
      .expect(200)

    await waitForSignals(1)

    const response = await viewer.get('/api/v1/recommendations/for-you').expect(200)
    const peers = response.body.sections.otherGroups.find(
      (item: { slug: string }) => item.slug === 'filter-coffee',
    )
    expect(peers).toMatchObject({
      slug: 'filter-coffee',
      source: 'OTHER_GROUPS',
      reason: '1 neighbour has quoted this',
    })
    expect(peers.society.id).toBe(lakeviewId)
  })

  it('collapses repeated quotes from the same member into one signal', async () => {
    const response = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: 'recommend-dedupe@example.com',
        password: 'correct-horse',
        name: 'Dedupe Test',
      })
      .expect(201)
    const userId = response.body.user.id as string
    const agent = request.agent(server)
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'recommend-dedupe@example.com', password: 'correct-horse' })
      .expect(200)

    const campaign = await campaigns.findOneOrFail({ where: { slug: 'household-lentils' } })
    const waitForWeight = async (expected: number) => {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const row = await signals.findOne({
          where: { userId, campaignId: campaign.id },
        })
        if (row?.weight === expected) return
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      throw new Error(`Expected the quote signal weight to become ${expected}.`)
    }

    await agent.post('/api/v1/campaigns/household-lentils/quote').send({ quantity: 2 }).expect(200)
    await waitForWeight(2)

    await agent.post('/api/v1/campaigns/household-lentils/quote').send({ quantity: 5 }).expect(200)
    await waitForWeight(5)

    const rows = await signals.find({ where: { userId, campaignId: campaign.id } })
    expect(rows).toHaveLength(1)
  })

  it('requires a session and consent-shaped coordinates for nearby search', async () => {
    await request(server)
      .post('/api/v1/recommendations/nearby')
      .send({ latitude: 12.9698, longitude: 77.75 })
      .expect(401)

    const agent = await register('recommend-nearby@example.com')
    await agent
      .post('/api/v1/recommendations/nearby')
      .send({ latitude: 120, longitude: 77.75 })
      .expect(400)
    await agent.post('/api/v1/recommendations/nearby').send({ latitude: 12.9698 }).expect(400)
    await agent
      .post('/api/v1/recommendations/nearby')
      .send({ latitude: 28.6139, longitude: 77.209 })
      .expect(200)
      .expect(({ body }) => expect(body.groups).toEqual([]))
  })

  it('finds nearby groups, never echoes coordinates, and excludes joined groups', async () => {
    const agent = await register('recommend-nearby-groups@example.com')

    const close = await agent
      .post('/api/v1/recommendations/nearby')
      .send({ latitude: 12.9698, longitude: 77.75, radiusKm: 5 })
      .expect(200)
    expect(close.body.radiusKm).toBe(5)
    expect(close.body.groups.map((group: { name: string }) => group.name)).toEqual([MAPLE])
    expect(close.body.groups[0]).toMatchObject({
      id: mapleId,
      distanceKm: 0,
      activeCampaigns: 2,
    })
    expect(close.body.groups[0].topCampaign.slug).toBe('cold-pressed-oil')
    expect(JSON.stringify(close.body)).not.toContain('latitude')
    expect(JSON.stringify(close.body)).not.toContain('longitude')

    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    const afterJoining = await agent
      .post('/api/v1/recommendations/nearby')
      .send({ latitude: 12.9698, longitude: 77.75, radiusKm: 20 })
      .expect(200)
    expect(afterJoining.body.groups.map((group: { id: string }) => group.id)).not.toContain(mapleId)
    expect(afterJoining.body.groups.length).toBeGreaterThan(0)
    expect(afterJoining.body.groups.every((group: { distanceKm: number }) => group.distanceKm > 0)).toBe(
      true,
    )
    expect(
      afterJoining.body.groups.every(
        (group: { topCampaign: unknown }) => group.topCampaign !== null,
      ),
    ).toBe(true)
  })
})
