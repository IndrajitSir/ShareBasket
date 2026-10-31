import { loadConfig } from '../src/config/app-config'

const BASE = {
  NODE_ENV: 'test',
  AUTH_SECRET: 'test-only-session-secret-at-least-32-characters',
  PUBLIC_WEB_URL: 'http://localhost:3000',
}

describe('loadConfig auth settings', () => {
  it('allows development defaults but requires a strong secret in production', () => {
    const development = loadConfig({ ...BASE, AUTH_SECRET: undefined })
    expect(development.authSecret.length).toBeGreaterThanOrEqual(32)
    expect(development.google).toBeUndefined()
    expect(development.github).toBeUndefined()

    expect(() => loadConfig({ ...BASE, NODE_ENV: 'production', AUTH_SECRET: undefined })).toThrow(
      'AUTH_SECRET is required in production.',
    )
    expect(() =>
      loadConfig({ ...BASE, NODE_ENV: 'production', AUTH_SECRET: 'too-short' }),
    ).toThrow('AUTH_SECRET must be at least 32 characters.')

    expect(
      loadConfig({ ...BASE, NODE_ENV: 'production' }).sessionCookieSecure,
    ).toBe(true)
    expect(
      loadConfig({ ...BASE, NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' })
        .sessionCookieSecure,
    ).toBe(false)
  })

  it('validates the signal rate limit and defaults to 30 per minute', () => {
    expect(loadConfig(BASE).signalRateLimitPerMinute).toBe(30)
    expect(
      loadConfig({ ...BASE, SIGNAL_RATE_LIMIT_PER_MINUTE: '5' }).signalRateLimitPerMinute,
    ).toBe(5)
    expect(
      loadConfig({ ...BASE, SIGNAL_RATE_LIMIT_PER_MINUTE: '0' }).signalRateLimitPerMinute,
    ).toBe(0)
    expect(() =>
      loadConfig({ ...BASE, SIGNAL_RATE_LIMIT_PER_MINUTE: '-1' }),
    ).toThrow('SIGNAL_RATE_LIMIT_PER_MINUTE must be an integer between 0 and 10000.')
    expect(() =>
      loadConfig({ ...BASE, SIGNAL_RATE_LIMIT_PER_MINUTE: '1.5' }),
    ).toThrow('SIGNAL_RATE_LIMIT_PER_MINUTE must be an integer between 0 and 10000.')
  })

  it('rejects a partial OAuth pair and a web URL with a path', () => {
    expect(() =>
      loadConfig({ ...BASE, GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: undefined }),
    ).toThrow('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together.')

    expect(() =>
      loadConfig({ ...BASE, PUBLIC_WEB_URL: 'https://example.com/app' }),
    ).toThrow('PUBLIC_WEB_URL must be a bare http(s) origin')

    const configured = loadConfig({
      ...BASE,
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
    })
    expect(configured.google).toEqual({ clientId: 'google-id', clientSecret: 'google-secret' })
    expect(configured.github).toEqual({ clientId: 'github-id', clientSecret: 'github-secret' })
  })
})
