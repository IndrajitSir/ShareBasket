import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'

import { configureApp } from '../src/app.setup'
import { AuthModule } from '../src/auth/auth.module'
import { entities, migrations } from '../src/database/database-options'
import { SecurityModule } from '../src/security/security.module'
import { ConsoleMailer, type MailMessage } from '../src/security/console-mailer'

const TEST_ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'PUBLIC_WEB_URL',
  'SESSION_COOKIE_SECURE',
] as const

const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map((key) => [key, process.env[key]]))

async function createApp(): Promise<{ app: INestApplication; mailer: ConsoleMailer }> {
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
      SecurityModule,
    ],
  }).compile()

  const app = moduleRef.createNestApplication()
  configureApp(app, { corsOrigins: ['http://localhost:3001'] })
  await app.init()
  return { app, mailer: app.get(ConsoleMailer) }
}

describe('Security endpoints (email status, resend verification)', () => {
  let app: INestApplication
  const mailLog: MailMessage[] = []

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-security-secret-at-least-32-chars'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'
    process.env.SESSION_COOKIE_SECURE = 'false'
    const ctx = await createApp()
    app = ctx.app
    const mailer = ctx.mailer
    jest.spyOn(mailer, 'send').mockImplementation((msg: MailMessage) => {
      mailLog.push(msg)
    })
  })

  afterAll(async () => {
    await app.close()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  beforeEach(() => {
    mailLog.length = 0
  })

  it('returns email verification status for authenticated user', async () => {
    const email = 'status@example.com'
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Status', email, password: 'test-pass-123' })
      .expect(201)

    const cookies = reg.headers['set-cookie'] as unknown as string[]
    const session = cookies.find((c) => c.startsWith('sb_session='))!

    const status = await request(app.getHttpServer())
      .get('/api/v1/auth/email/status')
      .set('Cookie', session.split(';')[0])
      .expect(200)

    expect(status.body.verified).toBe(false)
  })

  it('rejects email status without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/email/status')
      .expect(401)
  })

  it('resends verification email', async () => {
    const email = 'resend@example.com'
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Resend', email, password: 'test-pass-123' })
      .expect(201)

    const cookies = reg.headers['set-cookie'] as unknown as string[]
    const session = cookies.find((c) => c.startsWith('sb_session='))!

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/resend-verification')
      .set('Cookie', session.split(';')[0])
      .expect(202)

    expect(mailLog.length).toBeGreaterThan(0)
    const verifyMail = mailLog.find((m) => m.actionUrl.includes('verify-email'))
    expect(verifyMail).toBeDefined()
    expect(verifyMail!.to).toBe(email)
  })

  it('rejects resend verification without authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/resend-verification')
      .expect(401)
  })

  it('rejects resend for already verified email', async () => {
    const email = 'already.verified@example.com'
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Verified', email, password: 'test-pass-123' })
      .expect(201)

    const cookies = reg.headers['set-cookie'] as unknown as string[]
    const session = cookies.find((c) => c.startsWith('sb_session='))!

    // Verify the email first
    const verifyMail = mailLog.find((m) => m.actionUrl.includes('verify-email'))
    expect(verifyMail).toBeDefined()
    const token = verifyMail!.actionUrl.split('token=')[1]

    await request(app.getHttpServer())
      .get(`/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`)
      .expect(302)

    // Now resend should fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/resend-verification')
      .set('Cookie', session.split(';')[0])
      .expect(409)
  })
})

describe('ApiExceptionFilter rate limiting', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-security-secret-at-least-32-chars'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'
    process.env.SESSION_COOKIE_SECURE = 'false'
    const ctx = await createApp()
    app = ctx.app
  })

  afterAll(async () => {
    await app.close()
  })

  it('maps TooManyAttemptsException to HTTP 429 with retry-after header', async () => {
    const email = 'filter-test@example.com'
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Filter', email, password: 'test-pass-123' })
      .expect(201)

    // Exhaust the rate limit (default is 5 attempts)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401)
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong' })

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBeDefined()
    expect(response.body.code).toBe('RATE_LIMITED')
  })
})
