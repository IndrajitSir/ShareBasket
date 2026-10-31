import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import {
  formatPaise,
  getCampaignProgress,
  quoteCampaign,
  selectUnitPrice,
  type PricedCampaign,
} from './campaign-pricing'
import { Campaign } from '../database/entities/campaign.entity'

const RELATIONS = {
  society: true,
  tiers: true,
  campaignProducts: { product: { category: true } },
} as const

export function toCampaignPreview(campaign: Campaign, now: Date = new Date()) {
  const priced: PricedCampaign = {
    unitsCommitted: campaign.unitsCommitted,
    minimumUnits: campaign.minimumUnits,
    closesAt: new Date(campaign.closesAt),
    tiers: campaign.tiers.map((tier) => ({
      minimumUnits: tier.minimumUnits,
      unitPricePaise: tier.unitPricePaise,
    })),
  }

  const progress = getCampaignProgress(priced)
  const currentUnitPricePaise = selectUnitPrice(priced.tiers, campaign.unitsCommitted)
  const isClosed = campaign.status !== 'OPEN' || now.getTime() >= priced.closesAt.getTime()

  return {
    slug: campaign.slug,
    product: campaign.campaignProducts[0]
      ? {
          slug: campaign.campaignProducts[0].product.slug,
          name: campaign.campaignProducts[0].product.name,
          category: campaign.campaignProducts[0].product.category?.key ?? null,
          image: campaign.campaignProducts[0].product.image,
          description: campaign.campaignProducts[0].product.description,
          short: campaign.campaignProducts[0].product.shortDescription,
        }
      : null,
    society: campaign.society.name,
    location: campaign.society.location,
    unitsCommitted: campaign.unitsCommitted,
    minimumUnits: campaign.minimumUnits,
    closesAt: priced.closesAt.toISOString(),
    deliveryDate: campaign.deliveryDate,
    status: campaign.status,
    isClosed,
    tiers: [...priced.tiers].sort((left, right) => left.minimumUnits - right.minimumUnits),
    currentUnitPricePaise,
    currentUnitPrice: formatPaise(currentUnitPricePaise),
    progress: {
      percent: progress.percent,
      minimumMet: progress.minimumMet,
      unitsRemaining: progress.unitsRemaining,
      nextTier: progress.nextTier,
    },
  }
}

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
  ) {}

  async list(options: {
    category?: string
    society?: string
    q?: string
    sort?: 'closing' | 'progress'
  }) {
    const campaigns = await this.campaigns.find({
      relations: RELATIONS,
      order: { closesAt: 'ASC' },
    })

    const term = options.q?.trim().toLowerCase()
    const filtered = campaigns.filter((campaign) => {
      if (options.society && campaign.society.name !== options.society) return false
      if (options.category) {
        const inCategory = campaign.campaignProducts.some(
          (campaignProduct) => campaignProduct.product.category?.key === options.category,
        )
        if (!inCategory) return false
      }
      if (!term) return true

      const haystack = [
        campaign.society.name,
        campaign.society.location,
        ...campaign.campaignProducts.flatMap((campaignProduct) => [
          campaignProduct.product.name,
          campaignProduct.product.shortDescription,
          campaignProduct.product.description,
          campaignProduct.product.category?.label ?? '',
        ]),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(term)
    })

    if (options.sort === 'progress') {
      filtered.sort(
        (left, right) =>
          getCampaignProgress(toPriced(left)).percent - getCampaignProgress(toPriced(right)).percent,
      )
      filtered.reverse()
    }

    return filtered.map((campaign) => toCampaignPreview(campaign))
  }

  async findBySlug(slug: string) {
    return this.campaigns.findOne({ where: { slug }, relations: RELATIONS })
  }

  async findOneOrFail(slug: string) {
    const campaign = await this.findBySlug(slug)
    if (!campaign) throw new NotFoundException('Campaign not found.')
    return campaign
  }

  async quote(slug: string, quantity: number, now: Date = new Date()) {
    const campaign = await this.findOneOrFail(slug)
    const priced = toPriced(campaign)
    const quote = quoteCampaign(priced, quantity, now)

    return {
      quantity: quote.quantity,
      unitPricePaise: quote.unitPricePaise,
      lineTotalPaise: quote.lineTotalPaise,
      currentUnitPricePaise: quote.currentUnitPricePaise,
      unitSavingPaise: quote.unitSavingPaise,
      unitsAfterCommitment: quote.unitsAfterCommitment,
      nextTier: quote.nextTier,
      unitsToNextTier: quote.unitsToNextTier,
      unitPrice: formatPaise(quote.unitPricePaise),
      lineTotal: formatPaise(quote.lineTotalPaise),
      currentUnitPrice: formatPaise(quote.currentUnitPricePaise),
    }
  }
}

function toPriced(campaign: Campaign): PricedCampaign {
  return {
    unitsCommitted: campaign.unitsCommitted,
    minimumUnits: campaign.minimumUnits,
    closesAt: new Date(campaign.closesAt),
    tiers: campaign.tiers.map((tier) => ({
      minimumUnits: tier.minimumUnits,
      unitPricePaise: tier.unitPricePaise,
    })),
  }
}
