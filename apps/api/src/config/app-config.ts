export type DbDriver = 'postgres' | 'sqlite'

export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
}

export interface AppConfig {
  nodeEnv: string
  isProduction: boolean
  port: number
  dbDriver: DbDriver
  databaseUrl?: string
  databaseSsl: boolean
  sqlitePath: string
  corsOrigins: string[]
  migrateOnBoot: boolean
  seedOnBoot: boolean
  seedAllowProduction: boolean
  authSecret: string
  publicWebUrl: string
  /** Defaults to production; override only for HTTP-only local demos. */
  sessionCookieSecure: boolean
  google?: OAuthClientConfig
  github?: OAuthClientConfig
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback
  if (['1', 'true', 'yes'].includes(value.toLowerCase())) return true
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false
  throw new Error(`Expected a boolean value, received "${value}".`)
}

function parsePort(value: string | undefined): number {
  // 0 is allowed and means "let the OS choose" (useful in tests); hosts set a real port.
  const port = Number(value?.trim() || 4000)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.')
  }
  return port
}

function parseOrigins(value: string | undefined): string[] {
  const origins = (value ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) throw new Error('CORS_ORIGINS must list at least one origin.')

  return origins.map((origin) => {
    if (origin === '*') {
      throw new Error('CORS_ORIGINS must not use a wildcard; list explicit http(s) origins.')
    }
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error(`CORS_ORIGINS contains an invalid origin: "${origin}".`)
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin.replace(/\/$/, '')) {
      throw new Error(`CORS_ORIGINS must contain bare http(s) origins, received "${origin}".`)
    }
    return url.origin
  })
}

const DEVELOPMENT_AUTH_SECRET = 'sharebasket-development-only-session-secret'

function parseAuthSecret(value: string | undefined, isProduction: boolean): string {
  const secret = value?.trim()
  if (!secret) {
    if (isProduction) throw new Error('AUTH_SECRET is required in production.')
    return DEVELOPMENT_AUTH_SECRET
  }
  if (secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.')
  return secret
}

function parsePublicWebUrl(value: string | undefined): string {
  const raw = value?.trim() || 'http://localhost:3000'
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`PUBLIC_WEB_URL is not a valid URL: "${raw}".`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_WEB_URL must be a bare http(s) origin, for example https://app.example.com.')
  }
  return url.origin
}

function parseOAuthPair(
  clientId: string | undefined,
  clientSecret: string | undefined,
  label: string,
): OAuthClientConfig | undefined {
  const id = clientId?.trim()
  const secret = clientSecret?.trim()
  if (!id && !secret) return undefined
  if (!id || !secret) {
    throw new Error(`${label}_CLIENT_ID and ${label}_CLIENT_SECRET must be set together.`)
  }
  return { clientId: id, clientSecret: secret }
}

/**
 * Reads and validates process environment configuration. Throwing here keeps
 * the process from serving traffic with a half-configured database, CORS,
 * session signing or OAuth provider.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV?.trim() || 'development'
  const isProduction = nodeEnv === 'production'
  const dbDriver = (env.DB_DRIVER?.trim() || 'sqlite') as DbDriver

  if (dbDriver !== 'postgres' && dbDriver !== 'sqlite') {
    throw new Error('DB_DRIVER must be either "postgres" or "sqlite".')
  }

  const databaseUrl = env.DATABASE_URL?.trim() || undefined
  if (dbDriver === 'postgres' && !databaseUrl) {
    throw new Error('DATABASE_URL is required when DB_DRIVER=postgres.')
  }
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a postgres:// or postgresql:// connection string.')
  }

  return {
    nodeEnv,
    isProduction,
    port: parsePort(env.PORT),
    dbDriver,
    databaseUrl,
    databaseSsl: parseBoolean(env.DATABASE_SSL, false),
    sqlitePath: env.SQLITE_PATH?.trim() || './data/sharebasket.sqlite',
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
    migrateOnBoot: parseBoolean(env.MIGRATE_ON_BOOT, false),
    seedOnBoot: parseBoolean(env.SEED_ON_BOOT, false),
    seedAllowProduction: parseBoolean(env.SEED_ALLOW_PRODUCTION, false),
    authSecret: parseAuthSecret(env.AUTH_SECRET, isProduction),
    publicWebUrl: parsePublicWebUrl(env.PUBLIC_WEB_URL),
    sessionCookieSecure: parseBoolean(env.SESSION_COOKIE_SECURE, isProduction),
    google: parseOAuthPair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, 'GOOGLE'),
    github: parseOAuthPair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, 'GITHUB'),
  }
}
