import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common'

import type { PublicUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/current-user.decorator'
import { SessionAuthGuard } from '../auth/session-auth.guard'
import { UpdateMemberRoleDto } from './dto/update-member-role.dto'
import { MembershipsService } from './memberships.service'
import { CurrentMembership, RequireSocietyRole } from './require-society-role'
import { SocietyScopeGuard } from './society-scope.guard'

/**
 * Society-scoped operations. Every route re-derives the caller's role from the
 * membership row; nothing about the role is accepted from the client.
 */
@Controller('societies')
@UseGuards(SessionAuthGuard, SocietyScopeGuard)
export class SocietiesController {
  constructor(private readonly memberships: MembershipsService) {}

  /** Any member may see the roster of the society they belong to. */
  @Get(':societyId/members')
  async listMembers(@CurrentMembership() membership: { societyId: string; role: string }) {
    const [society, members] = await Promise.all([
      this.memberships.describe(membership.societyId),
      this.memberships.listMembers(membership.societyId),
    ])
    return {
      societyId: membership.societyId,
      society,
      viewerRole: membership.role,
      members,
    }
  }

  /** Only a steward of this society may change another member's role. */
  @Patch(':societyId/members/:userId')
  @RequireSocietyRole('STEWARD')
  async changeRole(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return {
      member: await this.memberships.changeRole(
        user.id,
        membership.societyId,
        targetUserId,
        body.role,
      ),
    }
  }
}
