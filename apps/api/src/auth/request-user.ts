import type { Request } from 'express'

import { SESSION_COOKIE } from './auth.constants'
import type { AuthService } from './auth.service'
import type { PublicUser } from './auth.types'

export type SessionRequest = Request & { cookies?: Record<string, string> }

/** Optional authentication for public reads that personalize when signed in. */
export async function resolveRequestUser(
  auth: AuthService,
  request: SessionRequest,
): Promise<PublicUser | null> {
  const authorization = request.headers.authorization
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined
  const token = request.cookies?.[SESSION_COOKIE] ?? bearer
  return token ? auth.userFromToken(token) : null
}
