import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { SocietyRole } from './society-role'

export type { SocietyRole }

export const REQUIRE_SOCIETY_ROLE = 'society:required-role'

/** Verified by `SocietyScopeGuard` for the society named in the route. */
export interface SocietyMembershipContext {
  societyId: string
  role: SocietyRole
}

/**
 * Minimum role needed inside the society named by `:societyId`. Defaults to
 * `MEMBER` when absent, so a route is never silently public: the guard still
 * requires a membership.
 */
export const RequireSocietyRole = (role: SocietyRole) => SetMetadata(REQUIRE_SOCIETY_ROLE, role)

/** The verified membership context attached by `SocietyScopeGuard`. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SocietyMembershipContext =>
    context.switchToHttp().getRequest<{ societyMembership: SocietyMembershipContext }>()
      .societyMembership,
)
