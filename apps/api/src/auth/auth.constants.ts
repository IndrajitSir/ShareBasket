import type { CookieOptions } from 'express'

export const AUTH_CONFIG = 'AUTH_CONFIG'
export const SESSION_COOKIE = 'sb_session'
export const OAUTH_STATE_COOKIE = 'sb_oauth_state'

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  }
}

export function oauthStateCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: OAUTH_STATE_TTL_MS,
  }
}

export function clearedCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' }
}
