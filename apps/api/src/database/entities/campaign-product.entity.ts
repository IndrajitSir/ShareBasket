import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { Campaign } from './campaign.entity'
import { Product } from './product.entity'

@Entity('campaign_product_master')
@Index('uq_campaign_product', ['campaignId', 'productId'], { unique: true })
export class CampaignProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string

  @ManyToOne(() => Campaign, (campaign) => campaign.campaignProducts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product
}
