import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import type { PublicUser } from './auth.types'
import { resolveRequestUser, type SessionRequest } from './request-user'
import { AuthService } from './auth.service'

type AuthenticatedRequest = SessionRequest & { user?: PublicUser }

/** Accepts the HttpOnly session cookie or a trusted server's bearer token. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = await resolveRequestUser(this.auth, request)

    if (!user) throw new UnauthorizedException('Sign in to continue.')

    request.user = user
    return true
  }
}
