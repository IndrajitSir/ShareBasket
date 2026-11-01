import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { DataSource } from 'typeorm'

import { configureApp } from '../src/app.setup'
import { AuthModule } from '../src/auth/auth.module'
import { entities, migrations } from '../src/database/database-options'
import { SocietyMembership } from '../src/database/entities/society-membership.entity'
import { Society } from '../src/database/entities/society.entity'
import { seedDatabase } from '../src/database/seed-runner'
import { MembershipsModule } from '../src/memberships/memberships.module'

describe('Society membership roles (SQLite, migrated schema)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let mapleId: string
  let lakeviewId: string
  let cedarId: string
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

    const societies = await dataSource.getRepository(Society).find()
    const societyIdOf = (name: string) => societies.find((society) => society.name === name)!.id
    mapleId = societyIdOf('Maple Residency')
    lakeviewId = societyIdOf('Lakeview Enclave')
    cedarId = societyIdOf('Cedar Gardens')

    steward = await member('roles-steward@example.com')
    stewardId = await idOf(steward)
    await join(steward, mapleId)
  })

  afterAll(async () => {
    await app.close()
  })

  async function member(email: string) {
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse', name: `Member ${email}` })
      .expect(201)
    return agent
  }

  async function idOf(agent: ReturnType<typeof request.agent>): Promise<string> {
    return (await agent.get('/api/v1/auth/me').expect(200)).body.user.id as string
  }

  async function join(agent: ReturnType<typeof request.agent>, societyId: string) {
    const response = await agent.post(`/api/v1/me/groups/${societyId}`).expect(201)
    return response.body.group as {
      role: string
      status: string
      memberCount: number
      pendingRequests: number
    }
  }

  async function approve(
    approver: ReturnType<typeof request.agent>,
    societyId: string,
    agent: ReturnType<typeof request.agent>,
  ) {
    const userId = await idOf(agent)
    await approver
      .post(`/api/v1/societies/${societyId}/requests/${userId}/approve`)
      .expect(200)
  }

  async function joinActive(
    agent: ReturnType<typeof request.agent>,
    societyId: string,
    approver = steward,
  ) {
    await join(agent, societyId)
    await approve(approver, societyId, agent)
    const groups = await agent.get('/api/v1/me/groups').expect(200)
    return groups.body.groups.find((group: { id: string }) => group.id === societyId)
  }

  it('makes the first member a steward and later members plain members once approved', async () => {
    const firstGroups = await steward.get('/api/v1/me/groups').expect(200)
    expect(firstGroups.body.groups[0]).toMatchObject({ id: mapleId, role: 'STEWARD', status: 'ACTIVE' })

    const second = await member('roles-second@example.com')
    expect(await join(second, mapleId)).toMatchObject({
      role: 'MEMBER',
      status: 'PENDING',
      memberCount: 1,
    })

    await approve(steward, mapleId, second)
    const secondGroups = await second.get('/api/v1/me/groups').expect(200)
    expect(secondGroups.body.groups[0]).toMatchObject({ id: mapleId, role: 'MEMBER', status: 'ACTIVE' })
    expect(stewardId).toEqual(expect.any(String))
  })

  it('keeps the original role when a member joins the same group again', async () => {
    const returning = await member('roles-returning@example.com')
    await joinActive(returning, mapleId)

    const again = await join(returning, mapleId)
    expect(again).toMatchObject({ role: 'MEMBER', status: 'ACTIVE' })
  })

  it('never grants a steward role in a different society', async () => {
    const agent = await member('roles-two-groups@example.com')

    // Lakeview is empty, so this account bootstraps it as its steward...
    expect(await join(agent, lakeviewId)).toMatchObject({ role: 'STEWARD', status: 'ACTIVE' })

    // ...but Maple already has members, so joining it is a request.
    expect(await join(agent, mapleId)).toMatchObject({ role: 'MEMBER', status: 'PENDING' })
    await approve(steward, mapleId, agent)

    const groups = await agent.get('/api/v1/me/groups').expect(200)
    const byId = new Map(
      groups.body.groups.map((group: { id: string; role: string; status: string }) => [
        group.id,
        `${group.role}:${group.status}`,
      ]),
    )
    expect(byId.get(mapleId)).toBe('MEMBER:ACTIVE')
    expect(byId.get(lakeviewId)).toBe('STEWARD:ACTIVE')
  })

  it('hands the steward role to the earliest active member and skips pending requests', async () => {
    const founder = await member('roles-leaving-steward@example.com')
    const successor = await member('roles-successor@example.com')
    const last = await member('roles-last@example.com')
    const requester = await member('roles-pending@example.com')

    // Cedar Gardens is empty at first, so the founder bootstraps it.
    expect((await join(founder, cedarId)).role).toBe('STEWARD')
    expect((await join(successor, cedarId)).status).toBe('PENDING')
    await approve(founder, cedarId, successor)
    expect((await join(last, cedarId)).status).toBe('PENDING')
    await approve(founder, cedarId, last)

    // This account asks after everyone else, and is never approved.
    expect((await join(requester, cedarId)).status).toBe('PENDING')

    await founder.delete(`/api/v1/me/groups/${cedarId}`).expect(204)

    const successorGroups = await successor.get('/api/v1/me/groups').expect(200)
    expect(successorGroups.body.groups[0].role).toBe('STEWARD')

    // The pending requester is not a candidate, even though it asked first.
    const requesterGroups = await requester.get('/api/v1/me/groups').expect(200)
    expect(requesterGroups.body.groups[0]).toMatchObject({ role: 'MEMBER', status: 'PENDING' })

    // When the successor also leaves, the role continues down the active list.
    await successor.delete(`/api/v1/me/groups/${cedarId}`).expect(204)
    const lastGroups = await last.get('/api/v1/me/groups').expect(200)
    expect(lastGroups.body.groups[0].role).toBe('STEWARD')

    const stillPending = await requester.get('/api/v1/me/groups').expect(200)
    expect(stillPending.body.groups[0].role).toBe('MEMBER')
  })

  it('defaults a membership inserted with an explicit active status to MEMBER', async () => {
    const agent = await member('roles-default@example.com')
    const userId = await idOf(agent)

    const row = await dataSource.getRepository(SocietyMembership).save(
      dataSource.getRepository(SocietyMembership).create({
        userId,
        societyId: lakeviewId,
        status: 'ACTIVE',
      }),
    )

    expect(row.role).toBe('MEMBER')
  })
})
