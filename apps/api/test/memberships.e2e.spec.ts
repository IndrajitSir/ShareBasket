import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { DataSource } from 'typeorm'

import { configureApp } from '../src/app.setup'
import { AuthModule } from '../src/auth/auth.module'
import { entities, migrations } from '../src/database/database-options'
import { Society } from '../src/database/entities/society.entity'
import { seedDatabase } from '../src/database/seed-runner'
import { MembershipsModule } from '../src/memberships/memberships.module'

describe('Memberships API (SQLite, migrated schema)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let mapleId: string
  let steward: ReturnType<typeof request.agent>
  let stewardId: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-session-secret-at-least-32-characters'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3000'

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
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, { corsOrigins: ['http://localhost:3000'] })
    await app.init()
    dataSource = app.get(DataSource)
    await seedDatabase(dataSource)
    const maple = await dataSource
      .getRepository(Society)
      .findOneOrFail({ where: { name: 'Maple Residency' } })
    mapleId = maple.id

    // One active steward exists before the first test, so every later join is
    // a request rather than a bootstrap. Ordering between tests cannot then
    // change what the suite is exercising.
    steward = await register('member-steward@example.com')
    await steward.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    stewardId = (await steward.get('/api/v1/auth/me').expect(200)).body.user.id as string
  })

  afterAll(async () => {
    await app.close()
  })

  async function register(email: string) {
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse', name: 'Member Test' })
      .expect(201)
    return agent
  }

  async function idOf(agent: ReturnType<typeof request.agent>): Promise<string> {
    return (await agent.get('/api/v1/auth/me').expect(200)).body.user.id as string
  }

  it('requires a session for every group endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/groups').expect(401)
    await request(app.getHttpServer()).get(`/api/v1/me/groups/${mapleId}`).expect(401)
    await request(app.getHttpServer()).post(`/api/v1/me/groups/${mapleId}`).expect(401)
    await request(app.getHttpServer()).delete(`/api/v1/me/groups/${mapleId}`).expect(401)
    await request(app.getHttpServer()).get(`/api/v1/societies/${mapleId}/requests`).expect(401)
  })

  it('makes the first member an active steward and reports campaign counts', async () => {
    const groups = await steward.get('/api/v1/me/groups').expect(200)
    expect(groups.body.groups).toHaveLength(1)
    expect(groups.body.groups[0]).toMatchObject({
      id: mapleId,
      name: 'Maple Residency',
      location: 'Bengaluru · Whitefield',
      memberCount: 1,
      activeCampaigns: 2,
      role: 'STEWARD',
      status: 'ACTIVE',
      pendingRequests: 0,
    })

    const again = await steward.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(again.body.group).toMatchObject({ status: 'ACTIVE', role: 'STEWARD', memberCount: 1 })
  })

  it('turns a later join into a pending request that grants no access', async () => {
    const agent = await register('member-one@example.com')
    const joined = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    expect(joined.body.group).toMatchObject({
      id: mapleId,
      status: 'PENDING',
      role: 'MEMBER',
      memberCount: 1,
      pendingRequests: 0,
    })
    expect(joined.body.group.requestedAt).toEqual(expect.any(String))

    // The request is visible to its owner, but membership is not implied.
    const list = await agent.get('/api/v1/me/groups').expect(200)
    expect(list.body.groups[0]).toMatchObject({ status: 'PENDING', memberCount: 1 })

    const own = await agent.get(`/api/v1/me/groups/${mapleId}`).expect(200)
    expect(own.body.group.status).toBe('PENDING')

    const roster = await agent.get(`/api/v1/societies/${mapleId}/members`).expect(403)
    expect(roster.body.message).toContain('not a member')

    // Re-asking does not create a second request.
    const again = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(again.body.group.status).toBe('PENDING')
  })

  it('shows the queue only to a steward of that society', async () => {
    const agent = await register('member-two@example.com')
    const agentId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    const queue = await steward.get(`/api/v1/societies/${mapleId}/requests`).expect(200)
    expect(queue.body.requests).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: agentId, name: 'Member Test' })]),
    )
    expect(JSON.stringify(queue.body)).not.toContain('member-two@example.com')

    // A pending account cannot read the queue, and neither can an active member.
    await agent.get(`/api/v1/societies/${mapleId}/requests`).expect(403)

    const outsider = await register('member-outsider@example.com')
    await outsider.get(`/api/v1/societies/${mapleId}/requests`).expect(403)
  })

  it('lets a steward approve a request, after which the member has access', async () => {
    const agent = await register('member-approve@example.com')
    const agentId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    const before = await steward.get('/api/v1/me/groups').expect(200)
    const pendingBefore = before.body.groups[0].pendingRequests as number
    expect(pendingBefore).toBeGreaterThan(0)

    const approved = await steward
      .post(`/api/v1/societies/${mapleId}/requests/${agentId}/approve`)
      .expect(200)
    expect(approved.body.member).toMatchObject({ userId: agentId, role: 'MEMBER' })

    const roster = await agent.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(roster.body.viewerRole).toBe('MEMBER')

    const groups = await agent.get('/api/v1/me/groups').expect(200)
    expect(groups.body.groups[0].status).toBe('ACTIVE')

    const after = await steward.get('/api/v1/me/groups').expect(200)
    expect(after.body.groups[0].pendingRequests).toBe(pendingBefore - 1)

    // Approving again is a conflict rather than a silent no-op.
    const repeated = await steward
      .post(`/api/v1/societies/${mapleId}/requests/${agentId}/approve`)
      .expect(409)
    expect(repeated.body.code).toBe('CONFLICT')
  })

  it('lets a steward reject a request, and the account may ask again later', async () => {
    const agent = await register('member-reject@example.com')
    const agentId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    await steward.delete(`/api/v1/societies/${mapleId}/requests/${agentId}`).expect(204)

    const groups = await agent.get('/api/v1/me/groups').expect(200)
    expect(groups.body.groups).toEqual([])
    await agent.get(`/api/v1/me/groups/${mapleId}`).expect(404)
    await agent.get(`/api/v1/societies/${mapleId}/members`).expect(403)

    // Rejecting an unknown request is a 404, not a silent success.
    await steward.delete(`/api/v1/societies/${mapleId}/requests/${agentId}`).expect(404)

    const again = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(again.body.group.status).toBe('PENDING')
  })

  it('lets a requester cancel their own pending request', async () => {
    const agent = await register('member-cancel@example.com')
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    await agent.delete(`/api/v1/me/groups/${mapleId}`).expect(204)
    expect((await agent.get('/api/v1/me/groups').expect(200)).body.groups).toEqual([])
    await agent.delete(`/api/v1/me/groups/${mapleId}`).expect(404)
  })

  it('removes an active member when they leave', async () => {
    const agent = await register('member-leave@example.com')
    const agentId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await steward.post(`/api/v1/societies/${mapleId}/requests/${agentId}/approve`).expect(200)

    await agent.delete(`/api/v1/me/groups/${mapleId}`).expect(204)
    expect((await agent.get('/api/v1/me/groups').expect(200)).body.groups).toEqual([])
    await agent.delete(`/api/v1/me/groups/${mapleId}`).expect(404)
  })

  it('keeps an append-only trail of decisions for stewards only', async () => {
    const roster = await steward.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    const actions = roster.body.auditTrail.map((entry: { action: string }) => entry.action)

    expect(actions).toEqual(
      expect.arrayContaining([
        'STEWARD_BOOTSTRAPPED',
        'MEMBERSHIP_REQUESTED',
        'MEMBERSHIP_APPROVED',
        'MEMBERSHIP_REJECTED',
        'MEMBERSHIP_LEFT',
      ]),
    )
    expect(roster.body.auditTrail[0]).toMatchObject({
      action: expect.any(String),
      targetName: expect.any(String),
      createdAt: expect.any(String),
    })

    // A plain member sees the roster shape but no queue and no audit history.
    const member = await register('member-plain@example.com')
    const memberId = await idOf(member)
    await member.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await steward.post(`/api/v1/societies/${mapleId}/requests/${memberId}/approve`).expect(200)

    const memberRoster = await member.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(memberRoster.body.pendingRequests).toEqual([])
    expect(memberRoster.body.auditTrail).toEqual([])
  })

  it('rejects unknown or malformed group ids', async () => {
    const agent = await register('member-unknown@example.com')
    await agent.post('/api/v1/me/groups/00000000-0000-4000-8000-000000000000').expect(404)
    await agent.post('/api/v1/me/groups/not-a-uuid').expect(400)
    await agent.get('/api/v1/me/groups/not-a-uuid').expect(400)
    await steward.get('/api/v1/societies/not-a-uuid/requests').expect(404)
    await steward
      .post(`/api/v1/societies/${mapleId}/requests/not-a-uuid/approve`)
      .expect(400)
    expect(stewardId).toEqual(expect.any(String))
  })
})
