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
    const maple = await dataSource.getRepository(Society).findOneOrFail({ where: { name: 'Maple Residency' } })
    mapleId = maple.id
  })

  afterAll(async () => {
    await app.close()
  })

  async function register(agent: ReturnType<typeof request.agent>, email: string) {
    await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct-horse', name: 'Member Test' })
      .expect(201)
    return agent
  }

  it('requires a session for every group endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/groups').expect(401)
    await request(app.getHttpServer()).post(`/api/v1/me/groups/${mapleId}`).expect(401)
    await request(app.getHttpServer()).delete(`/api/v1/me/groups/${mapleId}`).expect(401)
  })

  it('joins idempotently and reports member and active campaign counts', async () => {
    const agent = request.agent(app.getHttpServer())
    await register(agent, 'member-one@example.com')

    const empty = await agent.get('/api/v1/me/groups').expect(200)
    expect(empty.body.groups).toEqual([])

    const joined = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(joined.body.group).toMatchObject({
      id: mapleId,
      name: 'Maple Residency',
      location: 'Bengaluru · Whitefield',
      memberCount: 1,
      activeCampaigns: 2,
    })

    const again = await agent.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(again.body.group.memberCount).toBe(1)

    const list = await agent.get('/api/v1/me/groups').expect(200)
    expect(list.body.groups).toHaveLength(1)
    expect(list.body.groups[0].activeCampaigns).toBe(2)
  })

  it('counts distinct members and supports leaving', async () => {
    const first = await register(request.agent(app.getHttpServer()), 'member-two@example.com')
    const second = await register(request.agent(app.getHttpServer()), 'member-three@example.com')

    await first.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    const joined = await second.post(`/api/v1/me/groups/${mapleId}`).expect(201)
    expect(joined.body.group.memberCount).toBeGreaterThanOrEqual(3)

    await first.delete(`/api/v1/me/groups/${mapleId}`).expect(204)
    expect((await first.get('/api/v1/me/groups').expect(200)).body.groups).toHaveLength(0)

    await first.delete(`/api/v1/me/groups/${mapleId}`).expect(404)
  })

  it('rejects unknown or malformed group ids', async () => {
    const agent = await register(request.agent(app.getHttpServer()), 'member-four@example.com')
    await agent.post('/api/v1/me/groups/00000000-0000-4000-8000-000000000000').expect(404)
    await agent.post('/api/v1/me/groups/not-a-uuid').expect(400)
  })
})
