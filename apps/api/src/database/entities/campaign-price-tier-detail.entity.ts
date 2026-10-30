import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Campaign } from './campaign.entity'

@Entity('campaign_price_tier_detail')
@Index('uq_campaign_tier_minimum', ['campaignId', 'minimumUnits'], { unique: true })
export class CampaignPriceTier {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string

  @ManyToOne(() => Campaign, (campaign) => campaign.tiers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign

  @Column({ name: 'minimum_units', type: 'int' })
  minimumUnits: number

  /** Authoritative tier price in integer paise. */
  @Column({ name: 'unit_price_paise', type: 'int' })
  unitPricePaise: number
}
