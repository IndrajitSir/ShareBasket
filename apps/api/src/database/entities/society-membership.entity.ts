import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import type { MembershipStatus } from '../../memberships/membership-status'
import type { SocietyRole } from '../../memberships/society-role'
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

  /**
   * Joining a society with members creates a PENDING request that a steward
   * must approve. Only ACTIVE rows grant access; the first member of an empty
   * society is bootstrapped as an ACTIVE steward so a group can start.
   */
  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status: MembershipStatus

  /**
   * Scoped to this society only. The first member becomes STEWARD so a group
   * is never left without someone who can manage its roster.
   */
  @Column({ type: 'varchar', length: 16, default: 'MEMBER' })
  role: SocietyRole

  @CreateDateColumn({ name: 'joined_at', type: Date })
  joinedAt: Date
}
