import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Campaign } from './campaign.entity'
import { User } from './user.entity'

export type CampaignSignalType = 'QUOTE'

/** Implicit interest only: a quote is not a commitment or purchase. */
@Entity('user_campaign_signal_detail')
@Index('uq_signal_user_campaign', ['userId', 'campaignId'], { unique: true })
@Index('ix_signal_campaign', ['campaignId'])
export class CampaignSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId: string

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign

  @Column({ name: 'signal_type', type: 'varchar', length: 20, default: 'QUOTE' })
  signalType: CampaignSignalType

  /** Quantity quoted, bounded by the quote API. */
  @Column({ type: 'int' })
  weight: number

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date
}
