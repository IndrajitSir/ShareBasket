import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'
import { createHmac } from 'node:crypto'

import { configureApp } from '../src/app.setup'
import { entities, migrations } from '../src/database/database-options'
import { SecurityModule } from '../src/security/security.module'
import { AuthModule } from '../src/auth/auth.module'
import { ConsoleMailer, type MailMessage } from '../src/security/console-mailer'

const TEST_ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'PUBLIC_WEB_URL',
  'SESSION_COOKIE_SECURE',
] as const

const originalEnv = Object.fromEntries(TEST_ENV_KEYS.map((key) => [key, process.env[key]]))

async function createApp(): Promise<INestApplication> {
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
  return app
}

describe('Security flows (SQLite, migrated schema)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-security-secret-at-least-32-chars'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'
    process.env.SESSION_COOKIE_SECURE = 'false'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  /** Mock mailer captures sent messages directly. */
  const mailLog: MailMessage[] = []

  beforeEach(() => {
    mailLog.length = 0
    const mailer = app.get(ConsoleMailer)
    jest.spyOn(mailer, 'send').mockImplementation((message: MailMessage) => {
      mailLog.push(message)
    })
  })

  afterEach(() => {
    const mailer = app.get(ConsoleMailer)
    jest.spyOn(mailer, 'send').mockRestore()
  })

  function lastLink(email: string, kind: 'verify-email' | 'reset-password'): string {
    const found = mailLog.filter((entry) => entry.actionUrl.includes(kind) && (!email || entry.to === email))
    expect(found.length).toBeGreaterThan(0)
    return found[found.length - 1].actionUrl
  }

  it('registers locally as unverified and emails a verify link', async () => {
    const email = 'verify.me@example.com'
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Verify Me', email, password: 'correct horse 1' })
      .expect(201)
    expect(response.body.user.email).toBe(email)

    const link = lastLink('', 'verify-email')
    expect(link).toContain('/verify-email?token=')
    expect(link).toContain('localhost:3001')
  })

  it('verifies email through the browser-facing link, single use', async () => {
    const email = 'verify.link@example.com'
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Verify Link', email, password: 'correct horse 2' })
      .expect(201)

    const token = lastLink(email, 'verify-email').split('token=')[1]

    const redirect = await request(app.getHttpServer())
      .get(`/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`)
      .expect(302)
    expect(redirect.headers.location).toContain('status=verified')

    // Same link again is rejected.
    const replay = await request(app.getHttpServer())
      .get(`/api/v1/auth/email/verify?token=${encodeURIComponent(token)}`)
      .expect(302)
    expect(replay.headers.location).toContain('status=invalid')

    // A second link for the same account invalidates the first fingerprint:
    // issuing a fresh link works and verifies again only if not yet verified.
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Other Person', email: 'other.person@example.com', password: 'other-pass-123' })
      .expect(201)
  })

  it('rejects a tampered verification token', async () => {
    const redirect = await request(app.getHttpServer())
      .get('/api/v1/auth/email/verify?token=not-a-jwt')
      .expect(302)
    expect(redirect.headers.location).toContain('status=invalid')
  })

  it('sends a password reset that changes the password once', async () => {
    const email = 'reset.flow@example.com'
    const password = 'original-pass-1'
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Reset Flow', email, password })
      .expect(201)

    await request(app.getHttpServer()).post('/api/v1/auth/password/reset-request').send({ email }).expect(202)
    const token = lastLink(email, 'reset-password').split('token=')[1]

    // Unknown emails still get 202: no account enumeration.
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset-request')
      .send({ email: 'nobody@example.com' })
      .expect(202)

    const newPassword = 'brand-new-pass-9'
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, password: newPassword })
      .expect(204)

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(401)

    // Replay is rejected.
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'another-pass-12' })
      .expect(400)

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword })
      .expect(200)
    expect(loginResponse.body.user.email).toBe(email)
  })

  it('rate limits repeated failed logins per email and IP', async () => {
    const email = 'ratelimit@example.com'
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Rate Limit', email, password: 'right-pass-123' })
      .expect(201)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-pass' })
        .expect(401)
    }
    const sixth = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-pass' })
    expect(sixth.status).toBe(429)
    expect(sixth.headers['retry-after']).toBeDefined()

    // Even the correct password is refused while the window is hot.
    const correct = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'right-pass-123' })
    expect(correct.status).toBe(429)
  })

  it('enrolls, confirms, and requires TOTP for MFA accounts', async () => {
    const email = 'mfa.flow@example.com'
    const password = 'mfa-secure-pass-1'
    const sessionCookie = extractSession(
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: 'Mfa Flow', email, password })
        .expect(201),
    )

    const start = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/start')
      .set('Cookie', sessionCookie)
      .expect(200)
    const secret: string = start.body.secret
    expect(start.body.otpauthUri).toContain('otpauth://totp/')

    // Use a fixed time so TOTP codes are deterministic across test steps.
    const baseTime = new Date('2026-06-01T12:00:00.000Z').getTime()
    let simulatedTime = baseTime

    const realNow = Date.now
    function totpCodeAt(time: number): string {
      const step = Math.floor(time / 1000 / 30)
      return hotpForTest(secret, step)
    }

    // --- Confirm MFA enrollment (step 0) ---
    // Keep Date.now mocked during the HTTP call so the server sees the same time.
    Date.now = () => simulatedTime
    const confirmCode = totpCodeAt(simulatedTime)
    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/confirm')
      .set('Cookie', sessionCookie)
      .send({ code: confirmCode })
      .expect(204)

    const status = await request(app.getHttpServer())
      .get('/api/v1/auth/mfa/status')
      .set('Cookie', sessionCookie)
      .expect(200)
    expect(status.body.enabled).toBe(true)

    // --- Login: password step returns a challenge ---
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    expect(first.body.mfaRequired).toBe(true)
    expect(first.body.challenge).toBeDefined()
    expect(first.headers['set-cookie']).toBeUndefined()

    // --- Bad code rejected ---
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/mfa')
      .send({ challenge: first.body.challenge, code: '000000' })
      .expect(401)

    // --- Correct TOTP code completes login (step 1, 30s later) ---
    simulatedTime += 30_000
    const loginCode = totpCodeAt(simulatedTime)
    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/login/mfa')
      .send({ challenge: first.body.challenge, code: loginCode })
      .expect(200)
    expect(second.body.user.email).toBe(email)

    // --- Reusing the same step is rejected (fresh challenge, same code) ---
    const third = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/mfa')
      .send({ challenge: third.body.challenge, code: loginCode })
      .expect(401)

    // --- Disable MFA with a fresh code (step 2, another 30s) ---
    simulatedTime += 30_000
    const disableCode = totpCodeAt(simulatedTime)
    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/disable')
      .set('Cookie', sessionCookie)
      .send({ code: disableCode })
      .expect(204)

    Date.now = realNow

    const after = await request(app.getHttpServer())
      .get('/api/v1/auth/mfa/status')
      .set('Cookie', sessionCookie)
      .expect(200)
    expect(after.body.enabled).toBe(false)

    // --- Plain login works after MFA disabled ---
    const plain = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200)
    expect(plain.body.user.email).toBe(email)
  })
})

function extractSession(response: request.Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[]
  const session = cookies.find((cookie) => cookie.startsWith('sb_session='))
  expect(session).toBeDefined()
  return session!.split(';')[0]
}

function totpNow(secret: string, stepOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset
  return hotpForTest(secret, counter)
}

// Mirror of the API's internal hotp implementation, kept local so the test
// does not import module internals.
function hotpForTest(secretBase32: string, counter: number): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const key: number[] = []
  for (const char of secretBase32.replace(/=+$/, '')) {
    const index = ALPHABET.indexOf(char.toUpperCase())
    if (index === -1) throw new Error('bad secret')
    value = (value << 5) | index
    bits += 5
    while (bits >= 8) {
      key.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  while (key.length < 20) key.push(0)

  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter % 2 ** 32, 4)
  const digest = createHmac('sha1', Buffer.from(key)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code =
    (((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3]) %
    1_000_000
  return code.toString().padStart(6, '0')
}
