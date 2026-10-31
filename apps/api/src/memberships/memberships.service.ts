import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'

import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import { ROLE_RANK, type SocietyRole } from './society-role'

export interface GroupSummary {
  id: string
  name: string
  location: string
  memberCount: number
  activeCampaigns: number
  role: SocietyRole
}

export interface GroupMember {
  userId: string
  name: string
  role: SocietyRole
  joinedAt: string
}

/**
 * Preview society membership with one scoped role per membership row. Roles
 * are never global: `STEWARD` only applies to that society, and every write
 * here is reached through the scope guard.
 */
@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(SocietyMembership)
    private readonly memberships: Repository<SocietyMembership>,
    @InjectRepository(Society) private readonly societies: Repository<Society>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
  ) {}

  async listForUser(userId: string): Promise<GroupSummary[]> {
    const rows = await this.memberships.find({
      where: { userId },
      relations: { society: true },
      order: { joinedAt: 'ASC' },
    })
    if (rows.length === 0) return []

    const societyIds = rows.map((row) => row.societyId)
    const [memberCounts, campaignCounts] = await Promise.all([
      this.memberships
        .createQueryBuilder('membership')
        .select('membership.society_id', 'societyId')
        .addSelect('COUNT(*)', 'count')
        .where('membership.society_id IN (:...societyIds)', { societyIds })
        .groupBy('membership.society_id')
        .getRawMany<{ societyId: string; count: string }>(),
      this.campaigns
        .createQueryBuilder('campaign')
        .select('campaign.society_id', 'societyId')
        .addSelect('COUNT(*)', 'count')
        .where('campaign.society_id IN (:...societyIds)', { societyIds })
        .andWhere('campaign.status = :status', { status: 'OPEN' })
        .andWhere('campaign.closesAt > :now', { now: new Date() })
        .groupBy('campaign.society_id')
        .getRawMany<{ societyId: string; count: string }>(),
    ])

    return rows.map((row) =>
      this.toSummary(row.society, memberCounts, campaignCounts, row.role),
    )
  }

  /**
   * Joins immediately. The first member of a society becomes its STEWARD, so
   * a group always has someone who can manage the roster. Two simultaneous
   * first joins can both observe an empty group; the unique index keeps one
   * membership each, and the later joiner is left as STEWARD only in that
   * narrow race (see docs/RBAC_PERMISSIONS.md).
   */
  async join(userId: string, societyId: string): Promise<GroupSummary> {
    const society = await this.societies.findOne({ where: { id: societyId } })
    if (!society) throw new NotFoundException('Group not found.')

    const existing = await this.memberships.findOne({ where: { userId, societyId } })
    let role: SocietyRole = existing?.role ?? 'MEMBER'

    if (!existing) {
      const memberCount = await this.memberships.countBy({ societyId })
      role = memberCount === 0 ? 'STEWARD' : 'MEMBER'
      try {
        await this.memberships.save(
          this.memberships.create({ userId, societyId, status: 'ACTIVE', role }),
        )
      } catch (error) {
        // A concurrent join can win the unique constraint; treat it as success.
        const raced = await this.memberships.findOne({ where: { userId, societyId } })
        if (!raced) throw error
        role = raced.role
      }
    }

    return this.summaryFor(society, role)
  }

  /**
   * A departing steward hands the role to the earliest remaining member, so a
   * group with members never loses its steward.
   */
  async leave(userId: string, societyId: string): Promise<void> {
    const membership = await this.memberships.findOne({ where: { userId, societyId } })
    if (!membership) {
      throw new NotFoundException('You are not a member of this group.')
    }
    await this.memberships.delete({ id: membership.id })

    if (membership.role !== 'STEWARD') return
    const remainingSteward = await this.memberships.findOne({
      where: { societyId, role: 'STEWARD' },
    })
    if (remainingSteward) return

    const successor = await this.memberships.findOne({
      where: { societyId },
      order: { joinedAt: 'ASC' },
    })
    if (!successor) return

    successor.role = 'STEWARD'
    await this.memberships.save(successor)
  }

  /** The caller's role for one society, or null when they are not a member. */
  async roleFor(userId: string, societyId: string): Promise<SocietyRole | null> {
    const row = await this.memberships.findOne({
      where: { userId, societyId },
      select: { role: true },
    })
    return row?.role ?? null
  }

  /** Stewards first, then earliest joiners. Names only; never emails. */
  async listMembers(societyId: string): Promise<GroupMember[]> {
    const rows = await this.memberships.find({
      where: { societyId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    })

    return rows
      .map((row) => ({
        userId: row.userId,
        name: row.user.name,
        role: row.role,
        joinedAt: new Date(row.joinedAt).toISOString(),
      }))
      .sort(
        (left, right) =>
          ROLE_RANK[right.role] - ROLE_RANK[left.role] ||
          left.joinedAt.localeCompare(right.joinedAt) ||
          left.userId.localeCompare(right.userId),
      )
  }

  /**
   * Steward-only role change. Members cannot grant themselves a role, and the
   * society must keep at least one steward.
   */
  async changeRole(
    actorId: string,
    societyId: string,
    targetUserId: string,
    role: SocietyRole,
  ): Promise<GroupMember> {
    if (actorId === targetUserId) {
      throw new ConflictException('You cannot change your own role.')
    }

    const target = await this.memberships.findOne({
      where: { userId: targetUserId, societyId },
      relations: { user: true },
    })
    if (!target) throw new NotFoundException('Member not found.')

    if (target.role !== role) {
      if (target.role === 'STEWARD' && role === 'MEMBER') {
        const stewards = await this.memberships.countBy({ societyId, role: 'STEWARD' })
        if (stewards <= 1) {
          throw new ConflictException('A group needs at least one steward.')
        }
      }
      target.role = role
      await this.memberships.save(target)
    }

    return {
      userId: target.userId,
      name: target.user.name,
      role: target.role,
      joinedAt: new Date(target.joinedAt).toISOString(),
    }
  }

  private async summaryFor(society: Society, role: SocietyRole): Promise<GroupSummary> {
    const [memberCount, activeCampaigns] = await Promise.all([
      this.memberships.countBy({ societyId: society.id }),
      this.campaigns.count({
        where: { societyId: society.id, status: 'OPEN', closesAt: MoreThan(new Date()) },
      }),
    ])
    return {
      id: society.id,
      name: society.name,
      location: society.location,
      memberCount,
      activeCampaigns,
      role,
    }
  }

  private toSummary(
    society: Society,
    memberCounts: Array<{ societyId: string; count: string }>,
    campaignCounts: Array<{ societyId: string; count: string }>,
    role: SocietyRole,
  ): GroupSummary {
    const memberCount = Number(memberCounts.find((row) => row.societyId === society.id)?.count ?? 0)
    const activeCampaigns = Number(
      campaignCounts.find((row) => row.societyId === society.id)?.count ?? 0,
    )
    return {
      id: society.id,
      name: society.name,
      location: society.location,
      memberCount,
      activeCampaigns,
      role,
    }
  }
}
