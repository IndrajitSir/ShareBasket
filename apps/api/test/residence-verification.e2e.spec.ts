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

type Agent = ReturnType<typeof request.agent>

const CLAIM = { block: 'B', unit: '1204', tenancy: 'TENANT', attested: true }

describe('Residence verification (SQLite, migrated schema)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let mapleId: string
  let lakeviewId: string
  let cedarId: string
  let steward: Agent
  let stewardId: string
  let lakeviewSteward: Agent
  let cedarSteward: Agent

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

    const societies = await dataSource.getRepository(Society).find()
    mapleId = societies.find((society) => society.name === 'Maple Residency')!.id
    lakeviewId = societies.find((society) => society.name === 'Lakeview Enclave')!.id
    cedarId = societies.find((society) => society.name === 'Cedar Gardens')!.id

    steward = await register('residence-steward@example.com', 'Residence Steward')
    await steward.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    stewardId = await idOf(steward)

    lakeviewSteward = await register('residence-lakeview@example.com', 'Lakeview Steward')
    await lakeviewSteward.post(`/api/v1/me/groups/${lakeviewId}`).expect(201)

    cedarSteward = await register('residence-cedar@example.com', 'Cedar Steward')
    await cedarSteward.post(`/api/v1/me/groups/${cedarId}`).expect(201)
  })

  afterAll(async () => {
    await app.close()
  })

  async function register(email: string, name: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/v1/auth/register').send({ email, password: 'correct-horse', name }).expect(201)
    return agent
  }

  async function idOf(agent: Agent): Promise<string> {
    return (await agent.get('/api/v1/auth/me').expect(200)).body.user.id as string
  }

  async function activeMemberIn(
    societyId: string,
    approver: Agent,
    email: string,
    name = 'Residence Member',
  ) {
    const agent = await register(email, name)
    const userId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${societyId}`).expect(201)
    await approver
      .post(`/api/v1/societies/${societyId}/requests/${userId}/approve`)
      .expect(200)
    return { agent, userId }
  }

  async function activeMember(email: string, name = 'Residence Member') {
    return activeMemberIn(mapleId, steward, email, name)
  }

  function submit(agent: Agent, body: Record<string, unknown> = CLAIM) {
    return agent.post(`/api/v1/societies/${mapleId}/verification`).send(body)
  }

  function verify(actor: Agent, userId: string) {
    return actor.post(`/api/v1/societies/${mapleId}/verification/${userId}/verify`)
  }

  function reject(actor: Agent, userId: string) {
    return actor.post(`/api/v1/societies/${mapleId}/verification/${userId}/reject`)
  }

  it('requires a session for every verification route', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/societies/${mapleId}/verification`)
      .send(CLAIM)
      .expect(401)
    await request(app.getHttpServer())
      .post(`/api/v1/societies/${mapleId}/verification/${stewardId}/verify`)
      .expect(401)
    await request(app.getHttpServer())
      .post(`/api/v1/societies/${mapleId}/verification/${stewardId}/reject`)
      .expect(401)
  })

  it('blocks pending requests, outsiders and plain members from claiming or deciding', async () => {
    const pending = await register('residence-pending@example.com', 'Pending Requester')
    await pending.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await submit(pending).expect(403)

    const outsider = await register('residence-outsider@example.com', 'Outsider')
    await submit(outsider).expect(403)

    const { agent: plain } = await activeMember('residence-plain@example.com')
    await submit(plain).expect(200)
    await verify(plain, await idOf(plain)).expect(403)
    await reject(plain, await idOf(plain)).expect(403)

    // A steward of another society has no authority here.
    const target = await activeMember('residence-target@example.com')
    await submit(target.agent).expect(200)
    await verify(lakeviewSteward, target.userId).expect(403)
  })

  it('records a claim and shows unit details only to the claimant and stewards', async () => {
    const { agent, userId } = await activeMember('residence-claimant@example.com')

    const before = await agent.get('/api/v1/me/groups').expect(200)
    expect(before.body.groups[0].verificationStatus).toBe('UNVERIFIED')

    const claimed = await submit(agent).expect(200)
    expect(claimed.body.verification).toMatchObject({
      status: 'PENDING',
      block: 'B',
      unit: '1204',
      tenancy: 'TENANT',
    })
    expect(claimed.body.verification.submittedAt).toEqual(expect.any(String))
    expect(claimed.body.verification.decidedAt).toBeNull()

    const ownRoster = await agent.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(ownRoster.body.viewerVerification).toMatchObject({
      status: 'PENDING',
      unit: '1204',
      tenancy: 'TENANT',
    })
    expect(ownRoster.body.verificationQueue).toEqual([])
    const ownEntry = ownRoster.body.members.find(
      (member: { userId: string }) => member.userId === userId,
    )
    expect(ownEntry).toMatchObject({ verificationStatus: 'PENDING', verified: false })
    expect(ownEntry).not.toHaveProperty('residenceUnit')
    expect(JSON.stringify(ownRoster.body.members)).not.toContain('1204')

    const stewardRoster = await steward.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    const queued = stewardRoster.body.verificationQueue.find(
      (entry: { userId: string }) => entry.userId === userId,
    )
    expect(queued).toMatchObject({
      block: 'B',
      unit: '1204',
      tenancy: 'TENANT',
      name: 'Residence Member',
    })
    expect(queued.submittedAt).toEqual(expect.any(String))
  })

  it('rejects duplicate and malformed claims without changing state', async () => {
    const { agent } = await activeMember('residence-invalid@example.com')
    await submit(agent).expect(200)

    const duplicate = await submit(agent).expect(409)
    expect(duplicate.body.code).toBe('CONFLICT')

    const cases: Array<Record<string, unknown>> = [
      { ...CLAIM, unit: '' },
      { ...CLAIM, unit: 'A'.repeat(21) },
      { ...CLAIM, unit: '!!' },
      { ...CLAIM, tenancy: 'GUEST' },
      { ...CLAIM, attested: false },
      { block: 'B', unit: '12', tenancy: 'OWNER' },
      { ...CLAIM, block: 'B'.repeat(41) },
      { ...CLAIM, extra: true },
    ]
    for (const body of cases) {
      const response = await submit(agent, body).expect(400)
      expect(response.body.code).toBe('VALIDATION_ERROR')
    }

    // Every failed request was rejected before the row was touched.
    const groups = await agent.get('/api/v1/me/groups').expect(200)
    expect(groups.body.groups[0].verificationStatus).toBe('PENDING')
  })

  it('blocks self-review and lets another steward verify the founder', async () => {
    await submit(steward, {
      block: 'A',
      unit: '101',
      tenancy: 'OWNER',
      attested: true,
    }).expect(200)

    const selfReview = await verify(steward, stewardId).expect(409)
    expect(selfReview.body.code).toBe('CONFLICT')

    // A plain member cannot decide either, even for the steward who admitted them.
    const claimant = await activeMember('residence-claimant-two@example.com')
    await verify(claimant.agent, stewardId).expect(403)

    await submit(claimant.agent, {
      block: 'B',
      unit: '202',
      tenancy: 'TENANT',
      attested: true,
    }).expect(200)
    await verify(steward, claimant.userId).expect(200)

    // Verified residence is required before group authority is handed over.
    await steward
      .patch(`/api/v1/societies/${mapleId}/members/${claimant.userId}`)
      .send({ role: 'STEWARD' })
      .expect(200)

    const verified = await verify(claimant.agent, stewardId).expect(200)
    expect(verified.body.member).toMatchObject({
      userId: stewardId,
      role: 'STEWARD',
      verificationStatus: 'VERIFIED',
      verified: true,
    })

    const roster = await steward.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(roster.body.viewerVerification.status).toBe('VERIFIED')
  })

  it('requires verified residence before promoting a member to steward', async () => {
    const { agent, userId } = await activeMember('residence-promotion@example.com')

    const blocked = await steward
      .patch(`/api/v1/societies/${mapleId}/members/${userId}`)
      .send({ role: 'STEWARD' })
      .expect(409)
    expect(blocked.body.code).toBe('CONFLICT')
    expect(blocked.body.message).toMatch(/residence/i)

    await submit(agent).expect(200)
    await verify(steward, userId).expect(200)

    const promoted = await steward
      .patch(`/api/v1/societies/${mapleId}/members/${userId}`)
      .send({ role: 'STEWARD' })
      .expect(200)
    expect(promoted.body.member).toMatchObject({
      role: 'STEWARD',
      verificationStatus: 'VERIFIED',
    })
  })

  it('rejects a claim, lets the member correct it, then locks it once verified', async () => {
    const { agent, userId } = await activeMember('residence-correction@example.com')
    await submit(agent, { block: 'C', unit: '999', tenancy: 'OWNER', attested: true }).expect(200)

    const rejected = await reject(steward, userId).expect(200)
    expect(rejected.body.member).toMatchObject({
      verificationStatus: 'REJECTED',
      verified: false,
    })
    const own = await agent.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(own.body.viewerVerification.status).toBe('REJECTED')
    expect(own.body.viewerVerification.decidedAt).toEqual(expect.any(String))

    await submit(agent, { block: 'C', unit: '1001', tenancy: 'OWNER', attested: true }).expect(200)
    await verify(steward, userId).expect(200)

    await verify(steward, userId).expect(409)
    await reject(steward, userId).expect(409)
    await submit(agent).expect(409)
  })

  it('returns not-found for a member without a claim and validates ids', async () => {
    const { userId } = await activeMember('residence-no-claim@example.com')

    await verify(steward, userId).expect(409)
    await reject(steward, userId).expect(409)
    await verify(steward, '00000000-0000-4000-8000-000000000000').expect(404)
    await verify(steward, 'not-a-uuid').expect(400)
    await steward
      .post(`/api/v1/societies/not-a-uuid/verification/${userId}/verify`)
      .expect(404)
  })

  it('keeps verification scoped to one society', async () => {
    const agent = await register('residence-lakeview-member@example.com', 'Lakeview Member')
    const userId = await idOf(agent)
    await agent.post(`/api/v1/me/groups/${lakeviewId}`).expect(201)
    await lakeviewSteward
      .post(`/api/v1/societies/${lakeviewId}/requests/${userId}/approve`)
      .expect(200)

    await agent
      .post(`/api/v1/societies/${lakeviewId}/verification`)
      .send({ block: 'L', unit: '7', tenancy: 'FAMILY', attested: true })
      .expect(200)

    // The Maple steward cannot decide a Lakeview claim...
    await steward
      .post(`/api/v1/societies/${lakeviewId}/verification/${userId}/verify`)
      .expect(403)
    // ...but the Lakeview steward can, and Maple's queue does not contain it.
    const verified = await lakeviewSteward
      .post(`/api/v1/societies/${lakeviewId}/verification/${userId}/verify`)
      .expect(200)
    expect(verified.body.member.verificationStatus).toBe('VERIFIED')

    const mapleRoster = await steward.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(
      mapleRoster.body.verificationQueue.some(
        (entry: { userId: string }) => entry.userId === userId,
      ),
    ).toBe(false)
  })

  it('audits claims and decisions, and hides the trail from plain members', async () => {
    // A separate society keeps this trail small enough to inspect in full.
    const verifiedMember = await activeMemberIn(
      cedarId,
      cedarSteward,
      'residence-cedar-verified@example.com',
    )
    await verifiedMember.agent
      .post(`/api/v1/societies/${cedarId}/verification`)
      .send({ block: 'D', unit: '4', tenancy: 'TENANT', attested: true })
      .expect(200)
    await cedarSteward
      .post(`/api/v1/societies/${cedarId}/verification/${verifiedMember.userId}/verify`)
      .expect(200)

    const rejectedMember = await activeMemberIn(
      cedarId,
      cedarSteward,
      'residence-cedar-rejected@example.com',
    )
    await rejectedMember.agent
      .post(`/api/v1/societies/${cedarId}/verification`)
      .send({ block: 'D', unit: '5', tenancy: 'OWNER', attested: true })
      .expect(200)
    await cedarSteward
      .post(`/api/v1/societies/${cedarId}/verification/${rejectedMember.userId}/reject`)
      .expect(200)

    const roster = await cedarSteward
      .get(`/api/v1/societies/${cedarId}/members`)
      .expect(200)
    const actions = roster.body.auditTrail.map((entry: { action: string }) => entry.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'RESIDENCE_CLAIMED',
        'RESIDENCE_VERIFIED',
        'RESIDENCE_REJECTED',
      ]),
    )

    const plainRoster = await verifiedMember.agent
      .get(`/api/v1/societies/${cedarId}/members`)
      .expect(200)
    expect(plainRoster.body.auditTrail).toEqual([])
    expect(plainRoster.body.verificationQueue).toEqual([])
  })
})
