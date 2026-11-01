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
import { SubmitResidenceClaimDto } from './dto/submit-residence-claim.dto'
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
   * steward additionally receives the join and residence queues plus the recent
   * audit trail; those are empty arrays for plain members, so the shape stays
   * stable. Only the viewer sees their own unit details; other members expose a
   * verification status, never an address.
   */
  @Get(':societyId/members')
  async listMembers(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string; role: string },
  ) {
    const isSteward = membership.role === 'STEWARD'
    const [society, members, viewerVerification, pendingRequests, verificationQueue, auditTrail] =
      await Promise.all([
        this.memberships.describe(membership.societyId),
        this.memberships.listMembers(membership.societyId),
        this.memberships.residenceClaimFor(user.id, membership.societyId),
        isSteward ? this.memberships.listRequests(membership.societyId) : Promise.resolve([]),
        isSteward
          ? this.memberships.listVerificationRequests(membership.societyId)
          : Promise.resolve([]),
        isSteward ? this.memberships.recentAudit(membership.societyId) : Promise.resolve([]),
      ])
    return {
      societyId: membership.societyId,
      society,
      viewerRole: membership.role,
      members,
      viewerVerification,
      pendingRequests,
      verificationQueue,
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

  /** A member declares their block, unit and tenancy for steward review. */
  @Post(':societyId/verification')
  @HttpCode(200)
  async submitResidence(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Body() body: SubmitResidenceClaimDto,
  ) {
    return {
      verification: await this.memberships.submitResidenceClaim(user.id, membership.societyId, {
        block: body.block,
        unit: body.unit,
        tenancy: body.tenancy,
      }),
    }
  }

  /**
   * A steward confirms a neighbour's residence. The service refuses self-review,
   * so a steward who wants to be verified needs another steward of this society.
   */
  @Post(':societyId/verification/:userId/verify')
  @RequireSocietyRole('STEWARD')
  @HttpCode(200)
  async verifyResidence(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    return {
      member: await this.memberships.verifyResidence(
        user.id,
        membership.societyId,
        targetUserId,
      ),
    }
  }

  @Post(':societyId/verification/:userId/reject')
  @RequireSocietyRole('STEWARD')
  @HttpCode(200)
  async rejectResidence(
    @CurrentUser() user: PublicUser,
    @CurrentMembership() membership: { societyId: string },
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ) {
    return {
      member: await this.memberships.rejectResidence(
        user.id,
        membership.societyId,
        targetUserId,
      ),
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
