import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { formatPaise, selectUnitPrice } from '../campaigns/campaign-pricing'
import type { PublicUser } from '../auth/auth.types'
import { CampaignSignal } from '../database/entities/campaign-signal.entity'
import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import type { NearbyGroupsDto } from './dto/nearby.dto'
import { haversineKm, roundDistanceKm } from './geo'
import { MembershipsService } from '../memberships/memberships.service'
import {
  rankRecommendations,
  type CandidateCampaign,
  type RecommendationItem,
} from './recommendation-engine'

const RELATIONS = {
  society: true,
  tiers: true,
  campaignProducts: { product: { category: true } },
} as const

const MODEL = { name: 'hybrid-demand-cf', version: '1.0.0' } as const
const DEFAULT_RADIUS_KM = 10
const NEARBY_LIMIT = 12

interface CandidateWithDelivery extends CandidateCampaign {
  deliveryDate?: string
}

export interface CampaignRecommendation {
  slug: string
  product: {
    slug: string
    name: string
    image: string
    category: string
  }
  society: {
    id: string
    name: string
    location: string
  }
  currentUnitPricePaise: number
  currentUnitPrice: string
  unitsCommitted: number
  minimumUnits: number
  progressPercent: number
  closesAt: string
  deliveryDate?: string
  reason: string
  source: RecommendationItem['source']
}

export interface NearbyGroup {
  id: string
  name: string
  location: string
  distanceKm: number
  memberCount: number
  activeCampaigns: number
  topCampaign: CampaignRecommendation | null
}

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(CampaignSignal)
    private readonly signals: Repository<CampaignSignal>,
    @InjectRepository(SocietyMembership)
    private readonly memberships: Repository<SocietyMembership>,
    @InjectRepository(Society) private readonly societies: Repository<Society>,
    private readonly membershipsService: MembershipsService,
  ) {}

  async forUser(user: PublicUser | null) {
    const now = new Date()
    const [groups, candidates, memberships, signals] = await Promise.all([
      user ? this.membershipsService.listForUser(user.id) : Promise.resolve([]),
      this.loadCandidates(now),
      this.memberships.find({ select: { userId: true, societyId: true } }),
      this.loadSignals(),
    ])

    const ranked = rankRecommendations({
      userId: user?.id ?? null,
      userSocietyIds: groups.map((group) => group.id),
      candidates,
      memberships,
      signals,
      now,
    })

    const needsGroup = Boolean(user) && groups.length === 0
    return {
      signedIn: Boolean(user),
      personalized: Boolean(user) && groups.length > 0,
      needsGroup,
      needsLocation: needsGroup,
      groups,
      sections: {
        inYourGroups: ranked.inYourGroups.map((item) => this.toRecommendation(item)),
        otherGroups: ranked.otherGroups.map((item) => this.toRecommendation(item)),
        trending: ranked.trending.map((item) => this.toRecommendation(item)),
      },
      model: {
        name: MODEL.name,
        version: MODEL.version,
        generatedAt: now.toISOString(),
      },
    }
  }

  /**
   * Coordinates are consumed in memory and never persisted or echoed. Only
   * societies with stored coordinates participate.
   */
  async nearby(userId: string, dto: NearbyGroupsDto) {
    const now = new Date()
    const radiusKm = dto.radiusKm ?? DEFAULT_RADIUS_KM
    const [societies, candidates, memberCounts, joinedRows] = await Promise.all([
      this.societies.find(),
      this.loadCandidates(now),
      this.memberships
        .createQueryBuilder('membership')
        .select('membership.society_id', 'societyId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('membership.society_id')
        .getRawMany<{ societyId: string; count: string }>(),
      this.memberships.find({ where: { userId }, select: { societyId: true } }),
    ])
    const joined = new Set(joinedRows.map((row) => row.societyId))

    const bySociety = new Map<string, CandidateWithDelivery[]>()
    for (const candidate of candidates) {
      const list = bySociety.get(candidate.societyId) ?? []
      list.push(candidate)
      bySociety.set(candidate.societyId, list)
    }
    const memberCountBySociety = new Map(
      memberCounts.map((row) => [row.societyId, Number(row.count)]),
    )

    const groups: NearbyGroup[] = []
    for (const society of societies) {
      if (joined.has(society.id)) continue
      if (society.latitude === null || society.longitude === null) continue
      const distanceKm = haversineKm(
        { latitude: dto.latitude, longitude: dto.longitude },
        { latitude: society.latitude, longitude: society.longitude },
      )
      if (distanceKm > radiusKm) continue

      const active = (bySociety.get(society.id) ?? []).sort(
        (left, right) => right.unitsCommitted - left.unitsCommitted,
      )
      groups.push({
        id: society.id,
        name: society.name,
        location: society.location,
        distanceKm: roundDistanceKm(distanceKm),
        memberCount: memberCountBySociety.get(society.id) ?? 0,
        activeCampaigns: active.length,
        topCampaign: active[0]
          ? this.toCandidateRecommendation(active[0], 'Closest open group nearby', 'TRENDING')
          : null,
      })
    }

    groups.sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        right.activeCampaigns - left.activeCampaigns ||
        left.name.localeCompare(right.name),
    )

    return { radiusKm, groups: groups.slice(0, NEARBY_LIMIT) }
  }

  private async loadCandidates(now: Date): Promise<CandidateWithDelivery[]> {
    const campaigns = await this.campaigns.find({
      where: { status: 'OPEN' },
      relations: RELATIONS,
      order: { closesAt: 'ASC' },
    })

    const candidates: CandidateWithDelivery[] = []
    for (const campaign of campaigns) {
      if (new Date(campaign.closesAt).getTime() <= now.getTime()) continue
      const product = campaign.campaignProducts[0]?.product
      if (!product) continue
      const tiers = campaign.tiers.map((tier) => ({
        minimumUnits: tier.minimumUnits,
        unitPricePaise: tier.unitPricePaise,
      }))
      if (tiers.length === 0) continue

      candidates.push({
        slug: campaign.slug,
        productSlug: product.slug,
        productName: product.name,
        categoryKey: product.category?.key ?? 'uncategorised',
        image: product.image,
        societyId: campaign.societyId,
        societyName: campaign.society.name,
        location: campaign.society.location,
        unitsCommitted: campaign.unitsCommitted,
        minimumUnits: campaign.minimumUnits,
        closesAt: new Date(campaign.closesAt),
        currentUnitPricePaise: selectUnitPrice(tiers, campaign.unitsCommitted),
        deliveryDate: campaign.deliveryDate,
      })
    }
    return candidates
  }

  private async loadSignals(): Promise<
    Array<{ userId: string; campaignSlug: string; weight: number }>
  > {
    const rows = await this.signals
      .createQueryBuilder('signal')
      .innerJoin('signal.campaign', 'campaign')
      .select('signal.user_id', 'userId')
      .addSelect('campaign.slug', 'campaignSlug')
      .addSelect('signal.weight', 'weight')
      .getRawMany<{ userId: string; campaignSlug: string; weight: string | number }>()

    return rows.map((row) => ({
      userId: row.userId,
      campaignSlug: row.campaignSlug,
      weight: Number(row.weight),
    }))
  }

  private toRecommendation(item: RecommendationItem): CampaignRecommendation {
    return this.toCandidateRecommendation(item.campaign, item.reason, item.source)
  }

  private toCandidateRecommendation(
    candidate: CandidateWithDelivery,
    reason: string,
    source: RecommendationItem['source'],
  ): CampaignRecommendation {
    return {
      slug: candidate.slug,
      product: {
        slug: candidate.productSlug,
        name: candidate.productName,
        image: candidate.image,
        category: candidate.categoryKey,
      },
      society: {
        id: candidate.societyId,
        name: candidate.societyName,
        location: candidate.location,
      },
      currentUnitPricePaise: candidate.currentUnitPricePaise,
      currentUnitPrice: formatPaise(candidate.currentUnitPricePaise),
      unitsCommitted: candidate.unitsCommitted,
      minimumUnits: candidate.minimumUnits,
      progressPercent: Math.min(
        100,
        Math.max(0, Math.round((candidate.unitsCommitted / candidate.minimumUnits) * 100)),
      ),
      closesAt: candidate.closesAt.toISOString(),
      ...(candidate.deliveryDate ? { deliveryDate: candidate.deliveryDate } : {}),
      reason,
      source,
    }
  }
}
