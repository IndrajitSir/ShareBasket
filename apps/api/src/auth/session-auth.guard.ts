import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import type { Request } from 'express'

import { SESSION_COOKIE } from './auth.constants'
import { AuthService } from './auth.service'
import type { PublicUser } from './auth.types'

type AuthenticatedRequest = Request & {
  cookies?: Record<string, string>
  user?: PublicUser
}

/** Accepts the HttpOnly session cookie or a trusted server's bearer token. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const authorization = request.headers.authorization
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined
    const token = request.cookies?.[SESSION_COOKIE] ?? bearer
    const user = token ? await this.auth.userFromToken(token) : null

    if (!user) throw new UnauthorizedException('Sign in to continue.')

    request.user = user
    return true
  }
}
