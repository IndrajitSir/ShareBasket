import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import type { PublicUser } from '../auth/auth.types'
import { MembershipsService } from './memberships.service'
import {
  REQUIRE_SOCIETY_ROLE,
  type SocietyMembershipContext,
  type SocietyRole,
} from './require-society-role'

type ScopedRequest = Request & {
  user?: PublicUser
  societyMembership?: SocietyMembershipContext
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Scope-aware authorization. A role only counts inside the society in the URL,
 * so a steward of one group can never act on another. Runs after
 * `SessionAuthGuard`, which is what puts `request.user` on the request.
 */
@Injectable()
export class SocietyScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ScopedRequest>()
    const user = request.user
    if (!user) throw new ForbiddenException('Sign in to continue.')

    const societyId = String(request.params.societyId ?? '')
    if (!UUID.test(societyId)) throw new NotFoundException('Group not found.')

    const required =
      this.reflector.getAllAndOverride<SocietyRole>(REQUIRE_SOCIETY_ROLE, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'MEMBER'

    const role = await this.memberships.roleFor(user.id, societyId)
    if (!role) {
      // Only the denial path pays for the extra lookup, and it decides between
      // "this group does not exist" and "you are not a member of it".
      if (!(await this.memberships.societyExists(societyId))) {
        throw new NotFoundException('Group not found.')
      }
      throw new ForbiddenException('You are not a member of this group.')
    }

    if (!this.allows(role, required)) {
      throw new ForbiddenException('Your role in this group does not allow this action.')
    }

    request.societyMembership = { societyId, role }
    return true
  }

  private allows(actual: SocietyRole, required: SocietyRole): boolean {
    const rank: Record<SocietyRole, number> = { MEMBER: 1, STEWARD: 2 }
    return rank[actual] >= rank[required]
  }
}
