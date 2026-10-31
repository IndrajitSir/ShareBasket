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
    const idOf = (name: string) => societies.find((society) => society.name === name)!.id
    mapleId = idOf('Maple Residency')
    lakeviewId = idOf('Lakeview Enclave')
    cedarId = idOf('Cedar Gardens')
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

  async function join(agent: Awaited<ReturnType<typeof member>>, societyId: string) {
    const response = await agent.post(`/api/v1/me/groups/${societyId}`).expect(201)
    return response.body.group as { role: string; memberCount: number }
  }

  it('makes the first member a steward and later members plain members', async () => {
    const first = await member('roles-first@example.com')
    const second = await member('roles-second@example.com')

    expect(await join(first, mapleId)).toMatchObject({ role: 'STEWARD', memberCount: 1 })
    expect(await join(second, mapleId)).toMatchObject({ role: 'MEMBER', memberCount: 2 })

    const firstGroups = await first.get('/api/v1/me/groups').expect(200)
    expect(firstGroups.body.groups).toHaveLength(1)
    expect(firstGroups.body.groups[0]).toMatchObject({ id: mapleId, role: 'STEWARD' })

    const secondGroups = await second.get('/api/v1/me/groups').expect(200)
    expect(secondGroups.body.groups[0]).toMatchObject({ id: mapleId, role: 'MEMBER' })
  })

  it('keeps the original role when a member joins the same group again', async () => {
    const returning = await member('roles-returning@example.com')
    await join(returning, mapleId)

    const again = await join(returning, mapleId)
    expect(again).toMatchObject({ role: 'MEMBER', memberCount: 3 })
  })

  it('never grants a steward role in a different society', async () => {
    const agent = await member('roles-two-groups@example.com')

    expect((await join(agent, mapleId)).role).toBe('MEMBER')

    const lakeview = await join(agent, lakeviewId)
    expect(lakeview.role).toBe('STEWARD')

    const groups = await agent.get('/api/v1/me/groups').expect(200)
    const rolesById = new Map(
      groups.body.groups.map((group: { id: string; role: string }) => [group.id, group.role]),
    )
    expect(rolesById.get(mapleId)).toBe('MEMBER')
    expect(rolesById.get(lakeviewId)).toBe('STEWARD')
  })

  it('hands the steward role to the earliest remaining member when a steward leaves', async () => {
    const steward = await member('roles-leaving-steward@example.com')
    const successor = await member('roles-successor@example.com')
    const last = await member('roles-last@example.com')

    expect((await join(steward, cedarId)).role).toBe('STEWARD')
    expect((await join(successor, cedarId)).role).toBe('MEMBER')
    expect((await join(last, cedarId)).role).toBe('MEMBER')

    await steward.delete(`/api/v1/me/groups/${cedarId}`).expect(204)

    const successorGroups = await successor.get('/api/v1/me/groups').expect(200)
    expect(successorGroups.body.groups[0].role).toBe('STEWARD')

    const lastGroups = await last.get('/api/v1/me/groups').expect(200)
    expect(lastGroups.body.groups[0].role).toBe('MEMBER')
  })

  it('does not promote anyone when a plain member leaves', async () => {
    const groups = await dataSource
      .getRepository(SocietyMembership)
      .find({ where: { societyId: cedarId }, order: { joinedAt: 'ASC' } })
    const plainMember = groups.find((row) => row.role === 'MEMBER')!
    const before = groups.filter((row) => row.role === 'STEWARD').length

    await dataSource.getRepository(SocietyMembership).delete({ id: plainMember.id })

    const after = await dataSource
      .getRepository(SocietyMembership)
      .find({ where: { societyId: cedarId } })
    expect(after.filter((row) => row.role === 'STEWARD')).toHaveLength(before)
  })

  it('defaults a membership inserted without a role to MEMBER', async () => {
    const agent = await member('roles-default@example.com')
    const session = await agent.get('/api/v1/auth/me').expect(200)
    const userId = session.body.user.id as string

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
