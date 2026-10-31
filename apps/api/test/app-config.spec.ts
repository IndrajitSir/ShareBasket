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
