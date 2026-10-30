import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { CampaignPriceTier } from './campaign-price-tier-detail.entity'
import { CampaignProduct } from './campaign-product.entity'
import { Society } from './society.entity'

export type CampaignLifecycle = 'OPEN' | 'CLOSED' | 'CANCELLED'

@Entity('campaign_master')
@Index('uq_campaign_master_slug', ['slug'], { unique: true })
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80 })
  slug: string

  @Column({ name: 'society_id', type: 'uuid' })
  societyId: string

  @ManyToOne(() => Society, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'society_id' })
  society: Society

  /** Sample aggregate demand; not a live order count. */
  @Column({ name: 'units_committed', type: 'int' })
  unitsCommitted: number

  @Column({ name: 'minimum_units', type: 'int' })
  minimumUnits: number

  @Column({ name: 'closes_at', type: Date })
  closesAt: Date

  @Column({ name: 'delivery_date', type: 'date' })
  deliveryDate: string

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status: CampaignLifecycle

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date

  @OneToMany(() => CampaignProduct, (campaignProduct) => campaignProduct.campaign)
  campaignProducts: CampaignProduct[]

  @OneToMany(() => CampaignPriceTier, (tier) => tier.campaign)
  tiers: CampaignPriceTier[]
}
