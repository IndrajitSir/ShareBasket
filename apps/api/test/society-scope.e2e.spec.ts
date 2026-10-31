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

describe('Society scope authorization (SQLite, migrated schema)', () => {
  let app: INestApplication
  let dataSource: DataSource
  let mapleId: string
  let lakeviewId: string
  let steward: ReturnType<typeof request.agent>
  let plainMember: ReturnType<typeof request.agent>
  let memberId: string
  let stewardId: string
  let outsider: ReturnType<typeof request.agent>

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

    steward = await register('scope-steward@example.com', 'Steward Account')
    plainMember = await register('scope-member@example.com', 'Plain Member')
    outsider = await register('scope-outsider@example.com', 'Outsider Account')

    await steward.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    await plainMember.post(`/api/v1/me/groups/${mapleId}`).expect(201)

    const stewardMe = await steward.get('/api/v1/auth/me').expect(200)
    stewardId = stewardMe.body.user.id as string
    const memberMe = await plainMember.get('/api/v1/auth/me').expect(200)
    memberId = memberMe.body.user.id as string
  })

  afterAll(async () => {
    await app.close()
  })

  async function register(email: string, name: string) {
    const agent = request.agent(app.getHttpServer())
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse', name })
      .expect(201)
    return agent
  }

  it('requires a session for scoped society routes', async () => {
    await request(app.getHttpServer()).get(`/api/v1/societies/${mapleId}/members`).expect(401)
    await request(app.getHttpServer())
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'STEWARD' })
      .expect(401)
  })

  it('rejects non-members and treats unknown groups as not found', async () => {
    const forbidden = await outsider.get(`/api/v1/societies/${mapleId}/members`).expect(403)
    expect(forbidden.body.code).toBe('FORBIDDEN')

    await outsider
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'STEWARD' })
      .expect(403)

    await outsider
      .get('/api/v1/societies/00000000-0000-4000-8000-000000000000/members')
      .expect(404)
    await outsider.get('/api/v1/societies/not-a-uuid/members').expect(404)
  })

  it('shows a member a names-only roster with their own verified role', async () => {
    const response = await plainMember.get(`/api/v1/societies/${mapleId}/members`).expect(200)

    expect(response.body.societyId).toBe(mapleId)
    expect(response.body.society).toMatchObject({
      id: mapleId,
      name: 'Maple Residency',
      location: 'Bengaluru · Whitefield',
      memberCount: 2,
    })
    expect(response.body.viewerRole).toBe('MEMBER')
    expect(response.body.members).toHaveLength(2)
    expect(response.body.members[0]).toMatchObject({ userId: stewardId, role: 'STEWARD' })
    expect(response.body.members[1]).toMatchObject({ userId: memberId, role: 'MEMBER' })
    expect(response.body.members[0]).toHaveProperty('joinedAt')

    // No emails or other account identifiers beyond the opaque user id.
    expect(JSON.stringify(response.body)).not.toContain('scope-steward@example.com')
    expect(JSON.stringify(response.body)).not.toContain('scope-member@example.com')
    expect(response.body.members[0]).not.toHaveProperty('email')
  })

  it('blocks a plain member from granting themselves or others a role', async () => {
    await plainMember
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'STEWARD' })
      .expect(403)

    await plainMember
      .patch(`/api/v1/societies/${mapleId}/members/${stewardId}`)
      .send({ role: 'MEMBER' })
      .expect(403)

    const roster = await plainMember.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(roster.body.members.find((row: { userId: string }) => row.userId === memberId).role).toBe(
      'MEMBER',
    )
  })

  it('does not let a steward act in a society they do not belong to', async () => {
    await steward
      .patch(`/api/v1/societies/${lakeviewId}/members/${memberId}`)
      .send({ role: 'STEWARD' })
      .expect(403)
  })

  it('validates the requested role and the target member', async () => {
    await steward
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'OWNER' })
      .expect(400)

    await steward
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'STEWARD', extra: true })
      .expect(400)

    await steward
      .patch(`/api/v1/societies/${mapleId}/members/not-a-uuid`)
      .send({ role: 'STEWARD' })
      .expect(400)

    await steward
      .patch('/api/v1/societies/not-a-uuid/members/not-a-uuid')
      .send({ role: 'STEWARD' })
      .expect(404)

    const stranger = await register('scope-stranger@example.com', 'Stranger Account')
    const strangerMe = await stranger.get('/api/v1/auth/me').expect(200)
    await steward
      .patch(`/api/v1/societies/${mapleId}/members/${strangerMe.body.user.id}`)
      .send({ role: 'STEWARD' })
      .expect(404)
  })

  it('refuses a steward changing their own role', async () => {
    const response = await steward
      .patch(`/api/v1/societies/${mapleId}/members/${stewardId}`)
      .send({ role: 'MEMBER' })
      .expect(409)
    expect(response.body.code).toBe('CONFLICT')
  })

  it('promotes a member, who can then act as a steward in that society only', async () => {
    const promoted = await steward
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'STEWARD' })
      .expect(200)
    expect(promoted.body.member).toMatchObject({ userId: memberId, role: 'STEWARD' })

    const roster = await plainMember.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(roster.body.viewerRole).toBe('STEWARD')

    // The promoted member can now demote the original steward...
    await plainMember
      .patch(`/api/v1/societies/${mapleId}/members/${stewardId}`)
      .send({ role: 'MEMBER' })
      .expect(200)

    // ...and the demoted account immediately loses steward rights.
    await steward
      .patch(`/api/v1/societies/${mapleId}/members/${memberId}`)
      .send({ role: 'MEMBER' })
      .expect(403)

    const finalRoster = await plainMember.get(`/api/v1/societies/${mapleId}/members`).expect(200)
    expect(
      finalRoster.body.members.map((row: { userId: string; role: string }) => [row.userId, row.role]),
    ).toEqual([
      [memberId, 'STEWARD'],
      [stewardId, 'MEMBER'],
    ])
  })

  it('is idempotent when the requested role already matches', async () => {
    const response = await plainMember
      .patch(`/api/v1/societies/${mapleId}/members/${stewardId}`)
      .send({ role: 'MEMBER' })
      .expect(200)
    expect(response.body.member.role).toBe('MEMBER')
  })
})
