import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

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

  /**
   * Any active member may see the roster of the society they belong to. A
   * steward additionally receives the pending queue and the recent audit trail;
   * both are empty arrays for plain members, so the shape stays stable.
   */
  @Get(':societyId/members')
  async listMembers(@CurrentMembership() membership: { societyId: string; role: string }) {
    const isSteward = membership.role === 'STEWARD'
    const [society, members, pendingRequests, auditTrail] = await Promise.all([
      this.memberships.describe(membership.societyId),
      this.memberships.listMembers(membership.societyId),
      isSteward ? this.memberships.listRequests(membership.societyId) : Promise.resolve([]),
      isSteward ? this.memberships.recentAudit(membership.societyId) : Promise.resolve([]),
    ])
    return {
      societyId: membership.societyId,
      society,
      viewerRole: membership.role,
      members,
      pendingRequests,
      auditTrail,
    }
  }

  /** Steward-only review queue. Newest accounts are not privileged here. */
  @Get(':societyId/requests')
  @RequireSocietyRole('STEWARD')
  async listRequests(@CurrentMembership() membership: { societyId: string }) {
    return {
      societyId: membership.societyId,
      requests: await this.memberships.listRequests(membership.societyId),
    }
  }

  @Post(':societyId/requests/:userId/approve')
  @RequireSocietyRole('STEWARD')
  @HttpCode(200)
  async approve(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    return {
      member: await this.memberships.approveRequest(
        user.id,
        membership.societyId,
        targetUserId,
      ),
    }
  }

  @Delete(':societyId/requests/:userId')
  @RequireSocietyRole('STEWARD')
  @HttpCode(204)
  async reject(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.memberships.rejectRequest(user.id, membership.societyId, targetUserId)
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
