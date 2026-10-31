import { Inject, Injectable } from '@nestjs/common'

import { AUTH_CONFIG } from './auth.constants'
import type { ExternalProvider, OAuthProfile } from './auth.types'
import type { AppConfig } from '../config/app-config'

export class OAuthExchangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthExchangeError'
  }
}

const REQUEST_TIMEOUT_MS = 10_000

interface GoogleProfile {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

interface GitHubProfile {
  id?: number
  login?: string
  name?: string | null
  email?: string | null
  avatar_url?: string
}

interface GitHubEmail {
  email?: string
  primary?: boolean
  verified?: boolean
}

@Injectable()
export class OAuthService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AppConfig) {}

  isConfigured(provider: ExternalProvider): boolean {
    return Boolean(provider === 'google' ? this.config.google : this.config.github)
  }

  redirectUri(provider: ExternalProvider): string {
    return `${this.config.publicWebUrl}/api/backend/auth/${provider}/callback`
  }

  authorizeUrl(provider: ExternalProvider, state: string): string {
    const client = provider === 'google' ? this.config.google : this.config.github
    if (!client) throw new OAuthExchangeError(`${provider} sign-in is not configured.`)

    if (provider === 'google') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.searchParams.set('client_id', client.clientId)
      url.searchParams.set('redirect_uri', this.redirectUri(provider))
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid email profile')
      url.searchParams.set('state', state)
      url.searchParams.set('access_type', 'online')
      url.searchParams.set('prompt', 'select_account')
      return url.toString()
    }

    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', client.clientId)
    url.searchParams.set('redirect_uri', this.redirectUri(provider))
    url.searchParams.set('scope', 'read:user user:email')
    url.searchParams.set('state', state)
    return url.toString()
  }

  async exchange(provider: ExternalProvider, code: string): Promise<OAuthProfile> {
    return provider === 'google' ? this.exchangeGoogle(code) : this.exchangeGitHub(code)
  }

  private async exchangeGoogle(code: string): Promise<OAuthProfile> {
    const client = this.config.google
    if (!client) throw new OAuthExchangeError('Google sign-in is not configured.')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: this.redirectUri('google'),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const tokens = await this.readJson<{ access_token?: string }>(tokenResponse, 'Google token exchange')
    if (!tokens.access_token) throw new OAuthExchangeError('Google did not return an access token.')

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const profile = await this.readJson<GoogleProfile>(profileResponse, 'Google profile request')

    if (!profile.sub || !profile.email || profile.email_verified !== true) {
      throw new OAuthExchangeError('Google did not return a verified email address.')
    }

    return {
      provider: 'google',
      subject: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name?.trim() || profile.email.split('@')[0],
      avatarUrl: profile.picture ?? null,
      emailVerified: true,
    }
  }

  private async exchangeGitHub(code: string): Promise<OAuthProfile> {
    const client = this.config.github
    if (!client) throw new OAuthExchangeError('GitHub sign-in is not configured.')

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
        'user-agent': 'ShareBasket',
      },
      body: new URLSearchParams({
        code,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        redirect_uri: this.redirectUri('github'),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const tokens = await this.readJson<{ access_token?: string; error?: string }>(
      tokenResponse,
      'GitHub token exchange',
    )
    if (!tokens.access_token) throw new OAuthExchangeError('GitHub did not return an access token.')

    const headers = {
      authorization: `Bearer ${tokens.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'ShareBasket',
      'x-github-api-version': '2022-11-28',
    }
    const profileResponse = await fetch('https://api.github.com/user', {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const profile = await this.readJson<GitHubProfile>(profileResponse, 'GitHub profile request')

    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const emails = await this.readJson<GitHubEmail[]>(emailsResponse, 'GitHub email request')
    const verified = Array.isArray(emails)
      ? (emails.find((entry) => entry.primary && entry.verified) ??
        emails.find((entry) => entry.verified))
      : undefined

    if (!profile.id || !verified?.email) {
      throw new OAuthExchangeError('GitHub did not return a verified email address.')
    }

    return {
      provider: 'github',
      subject: String(profile.id),
      email: verified.email.toLowerCase(),
      name: profile.name?.trim() || profile.login?.trim() || verified.email.split('@')[0],
      avatarUrl: profile.avatar_url ?? null,
      emailVerified: true,
    }
  }

  private async readJson<T>(response: Response, label: string): Promise<T> {
    if (!response.ok) {
      throw new OAuthExchangeError(`${label} failed with status ${response.status}.`)
    }
    try {
      return (await response.json()) as T
    } catch {
      throw new OAuthExchangeError(`${label} returned an unreadable response.`)
    }
  }
}
