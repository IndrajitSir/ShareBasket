import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import request from 'supertest'

import { configureApp } from '../src/app.setup'
import { AuthModule } from '../src/auth/auth.module'
import { entities, migrations } from '../src/database/database-options'

const TEST_ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'PUBLIC_WEB_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
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
    ],
  }).compile()

  const app = moduleRef.createNestApplication()
  configureApp(app, { corsOrigins: ['http://localhost:3001'] })
  await app.init()
  return app
}

describe('Auth API (SQLite, migrated schema)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-session-secret-at-least-32-characters'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'
    process.env.GOOGLE_CLIENT_ID = 'google-test-client'
    process.env.GOOGLE_CLIENT_SECRET = 'google-test-secret'
    process.env.GITHUB_CLIENT_ID = 'github-test-client'
    process.env.GITHUB_CLIENT_SECRET = 'github-test-secret'
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    for (const key of TEST_ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('reports configured OAuth providers', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200)
    expect(response.body).toEqual({ google: true, github: true })
  })

  it('registers an account, sets an HttpOnly cookie and returns no password hash', async () => {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/v1/auth/register')
      .send({ email: ' Neighbour@Example.com ', password: 'correct-horse', name: ' Asha ' })
      .expect(201)

    expect(response.body.user).toMatchObject({
      email: 'neighbour@example.com',
      name: 'Asha',
      provider: 'local',
      avatarUrl: null,
    })
    expect(response.body.user.passwordHash).toBeUndefined()
    expect(response.body.user.id).toMatch(/^[0-9a-f-]{36}$/)

    const cookies = response.headers['set-cookie'] as unknown as string[]
    const session = cookies.find((cookie) => cookie.startsWith('sb_session='))
    expect(session).toBeDefined()
    expect(session).toContain('HttpOnly')
    expect(session).toContain('SameSite=Lax')
    expect(session).not.toContain('Secure')

    const me = await agent.get('/api/v1/auth/me').expect(200)
    expect(me.body.user.email).toBe('neighbour@example.com')
  })

  it('rejects duplicate emails, bad passwords and invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'duplicate@example.com', password: 'correct-horse', name: 'First' })
      .expect(201)

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'DUPLICATE@example.com', password: 'correct-horse', name: 'Second' })
      .expect(409)
    expect(duplicate.body.code).toBe('CONFLICT')

    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'duplicate@example.com', password: 'not-the-password' })
      .expect(401)
    expect(wrong.body.code).toBe('UNAUTHENTICATED')
    expect(wrong.body.message).toBe('Email or password is incorrect.')

    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'missing@example.com', password: 'not-the-password' })
      .expect(401)
    expect(unknown.body.message).toBe(wrong.body.message)

    const short = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: 'short', name: 'Short' })
      .expect(400)
    expect(short.body.code).toBe('VALIDATION_ERROR')
    expect(short.body.details[0].field).toBe('password')

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'extra@example.com', password: 'correct-horse', name: 'Extra', admin: true })
      .expect(400)
  })

  it('logs in, returns the session and clears the cookie on logout', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'login@example.com', password: 'correct-horse', name: 'Login User' })
      .expect(201)

    const agent = request.agent(app.getHttpServer())
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'LOGIN@example.com', password: 'correct-horse' })
      .expect(200)
    expect(login.body.user.email).toBe('login@example.com')
    expect(login.headers['set-cookie']).toBeDefined()

    await agent.get('/api/v1/auth/me').expect(200)

    const logout = await agent.post('/api/v1/auth/logout').expect(204)
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toMatch(/sb_session=;/)

    const me = await agent.get('/api/v1/auth/me').expect(401)
    expect(me.body.code).toBe('UNAUTHENTICATED')
  })

  it('rejects a missing or tampered session token', async () => {
    const missing = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401)
    expect(missing.body.message).toBe('Sign in to continue.')

    const tampered = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', 'sb_session=not-a-real-token')
      .expect(401)
    expect(tampered.body.code).toBe('UNAUTHENTICATED')
  })

  it('rejects OAuth callbacks with a missing or mismatched state', async () => {
    const agent = request.agent(app.getHttpServer())
    const start = await agent.get('/api/v1/auth/google').expect(302)
    expect(start.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth')
    expect(start.headers.location).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fbackend%2Fauth%2Fgoogle%2Fcallback')
    expect((start.headers['set-cookie'] as unknown as string[])[0]).toMatch(/sb_oauth_state=/)

    const mismatch = await agent
      .get('/api/v1/auth/google/callback?code=abc&state=wrong-state')
      .expect(302)
    expect(mismatch.headers.location).toBe('http://localhost:3001/login?error=oauth_state')
  })

  it('completes a Google OAuth callback and signs the user in', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'google-subject-1',
            email: 'OAuth.User@Example.com',
            email_verified: true,
            name: 'OAuth User',
            picture: 'https://example.com/avatar.png',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    })

    try {
      const agent = request.agent(app.getHttpServer())
      const start = await agent.get('/api/v1/auth/google').expect(302)
      const state = new URL(start.headers.location).searchParams.get('state')
      expect(state).toBeTruthy()

      const callback = await agent
        .get(`/api/v1/auth/google/callback?code=provider-code&state=${state}`)
        .expect(302)
      expect(callback.headers.location).toBe('http://localhost:3001/account?welcome=1')
      const cookies = callback.headers['set-cookie'] as unknown as string[]
      expect(cookies.some((cookie) => cookie.startsWith('sb_session='))).toBe(true)

      const me = await agent.get('/api/v1/auth/me').expect(200)
      expect(me.body.user).toMatchObject({
        email: 'oauth.user@example.com',
        name: 'OAuth User',
        provider: 'google',
        avatarUrl: 'https://example.com/avatar.png',
      })
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('links a verified OAuth email to an existing local account', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'link@example.com', password: 'correct-horse', name: 'Local User' })
      .expect(201)

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ access_token: 'provider-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'google-subject-link',
            email: 'link@example.com',
            email_verified: true,
            name: 'Linked User',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    })

    try {
      const agent = request.agent(app.getHttpServer())
      const start = await agent.get('/api/v1/auth/google').expect(302)
      const state = new URL(start.headers.location).searchParams.get('state')
      await agent.get(`/api/v1/auth/google/callback?code=code&state=${state}`).expect(302)

      const me = await agent.get('/api/v1/auth/me').expect(200)
      expect(me.body.user).toMatchObject({ email: 'link@example.com', provider: 'google' })

      // The original password still works after linking.
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'link@example.com', password: 'correct-horse' })
        .expect(200)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('Auth API without OAuth configuration', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AUTH_SECRET = 'test-only-session-secret-at-least-32-characters'
    process.env.PUBLIC_WEB_URL = 'http://localhost:3001'
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
    for (const key of TEST_ENV_KEYS) {
      const value = originalEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('hides providers and refuses to start an unconfigured OAuth flow', async () => {
    const providers = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200)
    expect(providers.body).toEqual({ google: false, github: false })

    const start = await request(app.getHttpServer()).get('/api/v1/auth/google').expect(503)
    expect(start.body.code).toBe('SERVICE_UNAVAILABLE')
  })
})
