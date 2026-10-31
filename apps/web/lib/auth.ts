import { cookies } from 'next/headers'

import { serverApiBase } from './api'
import type { AuthProviders, AuthUser } from './auth-types'

export type { AuthProviders, AuthUser } from './auth-types'

const NO_PROVIDERS: AuthProviders = { google: false, github: false }

export async function getAuthProviders(): Promise<AuthProviders> {
  try {
    const response = await fetch(`${serverApiBase()}/auth/providers`, { cache: 'no-store' })
    if (!response.ok) return NO_PROVIDERS
    return (await response.json()) as AuthProviders
  } catch {
    return NO_PROVIDERS
  }
}

/** Server components read the first-party cookie and verify it with the API. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = (await cookies()).get('sb_session')?.value
  if (!session) return null

  try {
    const response = await fetch(`${serverApiBase()}/auth/me`, {
      headers: { cookie: `sb_session=${session}` },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = (await response.json()) as { user?: AuthUser }
    return data.user ?? null
  } catch {
    return null
  }
}

export function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/account'
  }
  return value.slice(0, 300)
}
