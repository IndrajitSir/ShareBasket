import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm'

import { Campaign } from '../database/entities/campaign.entity'
import { SocietyAuditEvent } from '../database/entities/society-audit-event.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import { User } from '../database/entities/user.entity'
import type { MembershipStatus } from './membership-status'
import type { SocietyAuditAction } from './society-audit-action'
import { ROLE_RANK, type SocietyRole } from './society-role'

export interface GroupSummary {
  id: string
  name: string
  location: string
  memberCount: number
  activeCampaigns: number
  /** The role this account would hold, and holds once ACTIVE. Never global. */
  role: SocietyRole
  status: MembershipStatus
  /** Steward-only count of join requests waiting for review. */
  pendingRequests: number
  /** When a PENDING request was made; null for active memberships. */
  requestedAt: string | null
}

export interface GroupMember {
  userId: string
  name: string
  role: SocietyRole
  joinedAt: string
}

export interface GroupRequest {
  userId: string
  name: string
  requestedAt: string
}

export interface AuditEntry {
  id: string
  action: SocietyAuditAction
  actorName: string | null
  targetName: string
  fromRole: SocietyRole | null
  toRole: SocietyRole | null
  fromStatus: MembershipStatus | null
  toStatus: MembershipStatus | null
  createdAt: string
}

interface AuditInput {
  societyId: string
  action: SocietyAuditAction
  actor: { id: string; name: string } | null
  target: { id: string; name: string }
  fromStatus?: MembershipStatus | null
  toStatus?: MembershipStatus | null
  fromRole?: SocietyRole | null
  toRole?: SocietyRole | null
}

/**
 * Society membership with approval and an append-only audit trail.
 *
 * Joining a group that already has members creates a PENDING request; only a
 * steward of that same society can approve or reject it. The first member of an
 * empty society is bootstrapped as an ACTIVE steward, otherwise no group could
 * ever start. Every membership write and its audit event share one transaction,
 * so the trail cannot disagree with the rows it describes.
 */
@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(SocietyMembership)
    private readonly memberships: Repository<SocietyMembership>,
    @InjectRepository(Society) private readonly societies: Repository<Society>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async listForUser(userId: string): Promise<GroupSummary[]> {
    const rows = await this.memberships.find({
      where: { userId },
      relations: { society: true },
      order: { joinedAt: 'ASC' },
    })
    if (rows.length === 0) return []

    const societyIds = rows.map((row) => row.societyId)
    const [memberCounts, campaignCounts, pendingCounts] = await Promise.all([
      this.memberships
        .createQueryBuilder('membership')
        .select('membership.society_id', 'societyId')
        .addSelect('COUNT(*)', 'count')
        .where('membership.society_id IN (:...societyIds)', { societyIds })
        .andWhere('membership.status = :status', { status: 'ACTIVE' })
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
      this.memberships
        .createQueryBuilder('membership')
        .select('membership.society_id', 'societyId')
        .addSelect('COUNT(*)', 'count')
        .where('membership.society_id IN (:...societyIds)', { societyIds })
        .andWhere('membership.status = :status', { status: 'PENDING' })
        .groupBy('membership.society_id')
        .getRawMany<{ societyId: string; count: string }>(),
    ])

    return rows.map((row) =>
      this.toSummary(row.society, memberCounts, campaignCounts, pendingCounts, row),
    )
  }

  /**
   * Joining is a request unless the society is empty. Two simultaneous first
   * joins can both observe an empty group; the unique index still keeps one row
   * per account, and the later joiner is left as steward only in that narrow
   * race (documented in docs/RBAC_PERMISSIONS.md).
   */
  async join(userId: string, societyId: string): Promise<GroupSummary> {
    const society = await this.societies.findOne({ where: { id: societyId } })
    if (!society) throw new NotFoundException('Group not found.')

    const existing = await this.memberships.findOne({ where: { userId, societyId } })
    if (existing) return this.summaryFor(society, existing)

    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Account not found.')

    let membership: SocietyMembership
    try {
      membership = await this.dataSource.transaction(async (manager) => {
        const memberships = manager.getRepository(SocietyMembership)
        const activeCount = await memberships.countBy({ societyId, status: 'ACTIVE' })
        const bootstrap = activeCount === 0
        const created = await memberships.save(
          memberships.create({
            userId,
            societyId,
            status: bootstrap ? 'ACTIVE' : 'PENDING',
            role: bootstrap ? 'STEWARD' : 'MEMBER',
          }),
        )

        await this.record(manager, {
          societyId,
          action: bootstrap ? 'STEWARD_BOOTSTRAPPED' : 'MEMBERSHIP_REQUESTED',
          actor: { id: user.id, name: user.name },
          target: { id: user.id, name: user.name },
          fromStatus: null,
          toStatus: created.status,
          fromRole: null,
          toRole: created.role,
        })
        return created
      })
    } catch (error) {
      // A concurrent join can win the unique constraint; report the stored row.
      const raced = await this.memberships.findOne({ where: { userId, societyId } })
      if (!raced) throw error
      membership = raced
    }

    return this.summaryFor(society, membership)
  }

  /**
   * Leaves, or cancels a pending request. A departing steward hands the role to
   * the earliest remaining active member, so a group is never left headless.
   */
  async leave(userId: string, societyId: string): Promise<void> {
    const membership = await this.memberships.findOne({ where: { userId, societyId } })
    if (!membership) {
      throw new NotFoundException('You are not a member of this group.')
    }
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Account not found.')

    await this.dataSource.transaction(async (manager) => {
      const memberships = manager.getRepository(SocietyMembership)
      await memberships.delete({ id: membership.id })

      await this.record(manager, {
        societyId,
        action: 'MEMBERSHIP_LEFT',
        actor: { id: user.id, name: user.name },
        target: { id: user.id, name: user.name },
        fromStatus: membership.status,
        toStatus: null,
        fromRole: membership.role,
        toRole: null,
      })

      if (membership.role !== 'STEWARD' || membership.status !== 'ACTIVE') return

      const successor = await memberships.findOne({
        where: { societyId, status: 'ACTIVE' },
        order: { joinedAt: 'ASC' },
      })
      if (!successor) return

      successor.role = 'STEWARD'
      await memberships.save(successor)

      const successorUser = await manager.getRepository(User).findOne({
        where: { id: successor.userId },
      })
      await this.record(manager, {
        societyId,
        action: 'STEWARD_SUCCEEDED',
        actor: null,
        target: { id: successor.userId, name: successorUser?.name ?? 'Former member' },
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        fromRole: 'MEMBER',
        toRole: 'STEWARD',
      })
    })
  }

  async societyExists(societyId: string): Promise<boolean> {
    return (await this.societies.countBy({ id: societyId })) > 0
  }

  /** Public group identity plus its active member count, for the roster view. */
  async describe(societyId: string) {
    const society = await this.societies.findOne({ where: { id: societyId } })
    if (!society) throw new NotFoundException('Group not found.')
    return {
      id: society.id,
      name: society.name,
      location: society.location,
      memberCount: await this.memberships.countBy({ societyId, status: 'ACTIVE' }),
    }
  }

  /**
   * The caller's verified role for one society. A PENDING request deliberately
   * resolves to null: holding a request is not membership, so the scope guard
   * denies every society action until a steward approves it.
   */
  async roleFor(userId: string, societyId: string): Promise<SocietyRole | null> {
    const row = await this.memberships.findOne({
      where: { userId, societyId, status: 'ACTIVE' },
      select: { role: true },
    })
    return row?.role ?? null
  }

  /** The caller's own membership, pending or active, for the group page. */
  async membershipSummary(userId: string, societyId: string): Promise<GroupSummary> {
    const membership = await this.memberships.findOne({
      where: { userId, societyId },
      relations: { society: true },
    })
    if (!membership) throw new NotFoundException('You have not asked to join this group.')
    return this.summaryFor(membership.society, membership)
  }

  /** Active members only: stewards first, then earliest joiners. Never emails. */
  async listMembers(societyId: string): Promise<GroupMember[]> {
    const rows = await this.memberships.find({
      where: { societyId, status: 'ACTIVE' },
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

  /** Pending join requests for a steward to review, oldest first. */
  async listRequests(societyId: string): Promise<GroupRequest[]> {
    const rows = await this.memberships.find({
      where: { societyId, status: 'PENDING' },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    })

    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      requestedAt: new Date(row.joinedAt).toISOString(),
    }))
  }

  /** Newest first, capped: stewards see the recent history, not an export. */
  async recentAudit(societyId: string, limit = 25): Promise<AuditEntry[]> {
    const rows = await this.dataSource.getRepository(SocietyAuditEvent).find({
      where: { societyId },
      order: { createdAt: 'DESC' },
      take: limit,
    })

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorName: row.actorName,
      targetName: row.targetName,
      fromRole: row.fromRole,
      toRole: row.toRole,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      createdAt: new Date(row.createdAt).toISOString(),
    }))
  }

  async approveRequest(
    actorId: string,
    societyId: string,
    targetUserId: string,
  ): Promise<GroupMember> {
    const actor = await this.users.findOne({ where: { id: actorId } })
    if (!actor) throw new NotFoundException('Account not found.')

    return this.dataSource.transaction(async (manager) => {
      const memberships = manager.getRepository(SocietyMembership)
      const target = await memberships.findOne({
        where: { userId: targetUserId, societyId },
        relations: { user: true },
      })
      if (!target) throw new NotFoundException('Request not found.')
      if (target.status !== 'PENDING') {
        throw new ConflictException('That request is no longer waiting for review.')
      }

      target.status = 'ACTIVE'
      await memberships.save(target)

      await this.record(manager, {
        societyId,
        action: 'MEMBERSHIP_APPROVED',
        actor: { id: actor.id, name: actor.name },
        target: { id: target.userId, name: target.user.name },
        fromStatus: 'PENDING',
        toStatus: 'ACTIVE',
        fromRole: target.role,
        toRole: target.role,
      })

      return {
        userId: target.userId,
        name: target.user.name,
        role: target.role,
        joinedAt: new Date(target.joinedAt).toISOString(),
      }
    })
  }

  /**
   * Rejection deletes the request rather than storing a rejected row, so the
   * account may ask again later. The audit event keeps the target's name after
   * the row is gone.
   */
  async rejectRequest(actorId: string, societyId: string, targetUserId: string): Promise<void> {
    const actor = await this.users.findOne({ where: { id: actorId } })
    if (!actor) throw new NotFoundException('Account not found.')

    await this.dataSource.transaction(async (manager) => {
      const memberships = manager.getRepository(SocietyMembership)
      const target = await memberships.findOne({
        where: { userId: targetUserId, societyId },
        relations: { user: true },
      })
      if (!target) throw new NotFoundException('Request not found.')
      if (target.status !== 'PENDING') {
        throw new ConflictException('That request is no longer waiting for review.')
      }

      await memberships.delete({ id: target.id })

      await this.record(manager, {
        societyId,
        action: 'MEMBERSHIP_REJECTED',
        actor: { id: actor.id, name: actor.name },
        target: { id: target.userId, name: target.user.name },
        fromStatus: 'PENDING',
        toStatus: null,
        fromRole: target.role,
        toRole: null,
      })
    })
  }

  /**
   * Steward-only role change. Members cannot grant themselves a role, and the
   * society must keep at least one active steward.
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

    const actor = await this.users.findOne({ where: { id: actorId } })
    if (!actor) throw new NotFoundException('Account not found.')

    return this.dataSource.transaction(async (manager) => {
      const memberships = manager.getRepository(SocietyMembership)
      const target = await memberships.findOne({
        where: { userId: targetUserId, societyId, status: 'ACTIVE' },
        relations: { user: true },
      })
      if (!target) throw new NotFoundException('Member not found.')

      if (target.role !== role) {
        if (target.role === 'STEWARD' && role === 'MEMBER') {
          const stewards = await memberships.countBy({ societyId, role: 'STEWARD', status: 'ACTIVE' })
          if (stewards <= 1) {
            throw new ConflictException('A group needs at least one steward.')
          }
        }

        const previous = target.role
        target.role = role
        await memberships.save(target)

        await this.record(manager, {
          societyId,
          action: 'ROLE_CHANGED',
          actor: { id: actor.id, name: actor.name },
          target: { id: target.userId, name: target.user.name },
          fromStatus: 'ACTIVE',
          toStatus: 'ACTIVE',
          fromRole: previous,
          toRole: role,
        })
      }

      return {
        userId: target.userId,
        name: target.user.name,
        role: target.role,
        joinedAt: new Date(target.joinedAt).toISOString(),
      }
    })
  }

  /** Single insert path for the trail; there is no update or delete method. */
  private async record(manager: EntityManager, input: AuditInput): Promise<void> {
    await manager.getRepository(SocietyAuditEvent).insert({
      societyId: input.societyId,
      action: input.action,
      actorUserId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? null,
      targetUserId: input.target.id,
      targetName: input.target.name,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      fromRole: input.fromRole ?? null,
      toRole: input.toRole ?? null,
    })
  }

  private async summaryFor(
    society: Society,
    membership: SocietyMembership,
  ): Promise<GroupSummary> {
    const isActiveSteward = membership.status === 'ACTIVE' && membership.role === 'STEWARD'
    const [memberCount, activeCampaigns, pendingRequests] = await Promise.all([
      this.memberships.countBy({ societyId: society.id, status: 'ACTIVE' }),
      this.campaigns.count({
        where: { societyId: society.id, status: 'OPEN', closesAt: MoreThan(new Date()) },
      }),
      isActiveSteward
        ? this.memberships.countBy({ societyId: society.id, status: 'PENDING' })
        : Promise.resolve(0),
    ])
    return {
      id: society.id,
      name: society.name,
      location: society.location,
      memberCount,
      activeCampaigns,
      role: membership.role,
      status: membership.status,
      pendingRequests,
      requestedAt:
        membership.status === 'PENDING' ? new Date(membership.joinedAt).toISOString() : null,
    }
  }

  private toSummary(
    society: Society,
    memberCounts: Array<{ societyId: string; count: string }>,
    campaignCounts: Array<{ societyId: string; count: string }>,
    pendingCounts: Array<{ societyId: string; count: string }>,
    membership: SocietyMembership,
  ): GroupSummary {
    const countOf = (rows: Array<{ societyId: string; count: string }>) =>
      Number(rows.find((row) => row.societyId === society.id)?.count ?? 0)
    return {
      id: society.id,
      name: society.name,
      location: society.location,
      memberCount: countOf(memberCounts),
      activeCampaigns: countOf(campaignCounts),
      role: membership.role,
      status: membership.status,
      pendingRequests:
        membership.status === 'ACTIVE' && membership.role === 'STEWARD'
          ? countOf(pendingCounts)
          : 0,
      requestedAt:
        membership.status === 'PENDING' ? new Date(membership.joinedAt).toISOString() : null,
    }
  }
}
