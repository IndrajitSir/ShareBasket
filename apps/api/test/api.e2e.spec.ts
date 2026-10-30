import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { DataSource } from 'typeorm'

import { configureApp } from '../src/app.setup'
import { CampaignsModule } from '../src/campaigns/campaigns.module'
import { CatalogueModule } from '../src/catalogue/catalogue.module'
import { HealthModule } from '../src/health/health.module'
import { Campaign } from '../src/database/entities/campaign.entity'
import { entities, migrations } from '../src/database/database-options'
import { seedDatabase } from '../src/database/seed-runner'

describe('API (SQLite, migrated schema, seeded)', () => {
  let app: INestApplication
  let dataSource: DataSource

  beforeAll(async () => {
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
        CatalogueModule,
        CampaignsModule,
        HealthModule,
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, { corsOrigins: ['http://localhost:3000'] })
    await app.init()
    dataSource = app.get(DataSource)
    await seedDatabase(dataSource)
  })

  afterAll(async () => {
    await app.close()
  })

  it('reports health and database connectivity', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200)
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' })
  })

  it('echoes a safe caller request ID and rejects a malformed one', async () => {
    const echoed = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('X-Request-Id', 'test-request-123')
      .expect(200)
    expect(echoed.headers['x-request-id']).toBe('test-request-123')

    const generated = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('X-Request-Id', 'bad id with spaces')
      .expect(200)
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('lists seeded campaigns with server-calculated prices and progress', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/campaigns').expect(200)
    expect(response.body.previewOnly).toBe(true)
    expect(response.body.campaigns).toHaveLength(6)

    const rice = response.body.campaigns.find((campaign: { slug: string }) => campaign.slug === 'everyday-rice')
    expect(rice).toMatchObject({
      currentUnitPricePaise: 28900,
      currentUnitPrice: '₹289.00',
      unitsCommitted: 34,
    })
    expect(rice.progress).toMatchObject({ percent: 68, unitsRemaining: 16, minimumMet: false })
  })

  it('filters campaigns by community and category', async () => {
    const society = await request(app.getHttpServer())
      .get('/api/v1/campaigns?society=Maple%20Residency')
      .expect(200)
    expect(society.body.campaigns).toHaveLength(2)

    const category = await request(app.getHttpServer())
      .get('/api/v1/campaigns?category=ceramics')
      .expect(200)
    expect(category.body.campaigns).toEqual([])
  })

  it('returns campaign detail and a stable not-found error', async () => {
    const detail = await request(app.getHttpServer()).get('/api/v1/campaigns/everyday-rice').expect(200)
    expect(detail.body.campaign.progress.unitsRemaining).toBe(16)
    expect(detail.body.previewOnly).toBe(true)

    const missing = await request(app.getHttpServer()).get('/api/v1/campaigns/does-not-exist').expect(404)
    expect(missing.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND', message: 'Campaign not found.' })
    expect(missing.body.requestId).toBeTruthy()
  })

  it('quotes a quantity server-side and rejects invalid input', async () => {
    const quote = await request(app.getHttpServer())
      .post('/api/v1/campaigns/everyday-rice/quote')
      .send({ quantity: 16 })
      .expect(200)
    expect(quote.body.previewOnly).toBe(true)
    expect(quote.body.quote).toMatchObject({
      unitPrice: '₹269.00',
      lineTotal: '₹4,304.00',
      lineTotalPaise: 430400,
      unitsAfterCommitment: 50,
    })

    const zero = await request(app.getHttpServer())
      .post('/api/v1/campaigns/everyday-rice/quote')
      .send({ quantity: 0 })
      .expect(400)
    expect(zero.body.code).toBe('VALIDATION_ERROR')
    expect(zero.body.details[0].field).toBe('quantity')

    await request(app.getHttpServer())
      .post('/api/v1/campaigns/everyday-rice/quote')
      .send({ quantity: 2.5 })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/v1/campaigns/everyday-rice/quote')
      .send({ quantity: 21 })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/v1/campaigns/everyday-rice/quote')
      .send({ quantity: 1, note: 'unknown field' })
      .expect(400)

    await request(app.getHttpServer())
      .post('/api/v1/campaigns/does-not-exist/quote')
      .send({ quantity: 1 })
      .expect(404)
  })

  it('refuses quotes for a campaign whose closing time has passed', async () => {
    await dataSource.getRepository(Campaign).update({ slug: 'filter-coffee' }, { closesAt: new Date('2020-01-01T00:00:00Z') })

    const closed = await request(app.getHttpServer())
      .post('/api/v1/campaigns/filter-coffee/quote')
      .send({ quantity: 2 })
      .expect(409)
    expect(closed.body.code).toBe('CAMPAIGN_CLOSED')
  })

  it('paginates and filters the catalogue', async () => {
    const page = await request(app.getHttpServer()).get('/api/v1/products?limit=5&offset=0').expect(200)
    expect(page.body.items).toHaveLength(5)
    expect(page.body.page).toEqual({ limit: 5, offset: 0, total: 17 })

    const pantry = await request(app.getHttpServer()).get('/api/v1/products?category=pantry').expect(200)
    expect(pantry.body.items).toHaveLength(6)
    expect(pantry.body.items[0].price).toMatch(/^₹/)

    await request(app.getHttpServer()).get('/api/v1/products?limit=99').expect(400)
  })

  it('returns product detail and categories with counts', async () => {
    const product = await request(app.getHttpServer()).get('/api/v1/products/basmati-rice').expect(200)
    expect(product.body.product).toMatchObject({ slug: 'basmati-rice', pricePaise: 28900, category: 'pantry' })

    await request(app.getHttpServer()).get('/api/v1/products/nope').expect(404)

    const categories = await request(app.getHttpServer()).get('/api/v1/categories').expect(200)
    expect(categories.body.categories).toHaveLength(6)
    expect(categories.body.categories.find((category: { key: string }) => category.key === 'pantry').productCount).toBe(6)
  })

  it('returns a JSON 404 for unknown API routes and allows the configured origin', async () => {
    const missing = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404)
    expect(missing.body.code).toBe('NOT_FOUND')

    const cors = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('Origin', 'http://localhost:3000')
      .expect(200)
    expect(cors.headers['access-control-allow-origin']).toBe('http://localhost:3000')

    const blocked = await request(app.getHttpServer())
      .get('/api/v1/campaigns')
      .set('Origin', 'http://evil.example')
      .expect(200)
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined()
  })
})
