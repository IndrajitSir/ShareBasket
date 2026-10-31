import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Society } from './society.entity'
import { User } from './user.entity'

@Entity('society_membership_detail')
@Index('uq_society_membership', ['userId', 'societyId'], { unique: true })
@Index('ix_membership_society', ['societyId'])
export class SocietyMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'society_id', type: 'uuid' })
  societyId: string

  @ManyToOne(() => Society, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'society_id' })
  society: Society

  /** Preview memberships are immediately ACTIVE; approval is a later slice. */
  @Column({ type: 'varchar', length: 16, default: 'ACTIVE' })
  status: 'ACTIVE'

  @CreateDateColumn({ name: 'joined_at', type: Date })
  joinedAt: Date
}
