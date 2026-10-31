import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'

import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'

export interface GroupSummary {
  id: string
  name: string
  location: string
  memberCount: number
  activeCampaigns: number
}

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

    return rows.map((row) => this.toSummary(row.society, memberCounts, campaignCounts))
  }

  async join(userId: string, societyId: string): Promise<GroupSummary> {
    const society = await this.societies.findOne({ where: { id: societyId } })
    if (!society) throw new NotFoundException('Group not found.')

    const existing = await this.memberships.findOne({ where: { userId, societyId } })
    if (!existing) {
      try {
        await this.memberships.save(
          this.memberships.create({ userId, societyId, status: 'ACTIVE' }),
        )
      } catch (error) {
        // A concurrent join can win the unique constraint; treat it as success.
        const raced = await this.memberships.findOne({ where: { userId, societyId } })
        if (!raced) throw error
      }
    }

    return this.summaryFor(society)
  }

  async leave(userId: string, societyId: string): Promise<void> {
    const result = await this.memberships.delete({ userId, societyId })
    if (!result.affected) {
      throw new NotFoundException('You are not a member of this group.')
    }
  }

  private async summaryFor(society: Society): Promise<GroupSummary> {
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
    }
  }

  private toSummary(
    society: Society,
    memberCounts: Array<{ societyId: string; count: string }>,
    campaignCounts: Array<{ societyId: string; count: string }>,
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
    }
  }
}
