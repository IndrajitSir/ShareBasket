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
import type {
  MembershipVerificationStatus,
  TenancyType,
} from '../../memberships/membership-verification'
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

  /**
   * Residence verification, independent of approval: an active member can be
   * unverified, and only a steward who is not the claimant can confirm a unit.
   */
  @Column({ name: 'verification_status', type: 'varchar', length: 16, default: 'UNVERIFIED' })
  verificationStatus: MembershipVerificationStatus

  /** Block/tower within the society. Optional because small societies have none. */
  @Column({ name: 'residence_block', type: 'varchar', length: 40, nullable: true })
  residenceBlock: string | null

  /** Flat or house number, the only address detail stored. Never a street address. */
  @Column({ name: 'residence_unit', type: 'varchar', length: 20, nullable: true })
  residenceUnit: string | null

  @Column({ name: 'tenancy_type', type: 'varchar', length: 16, nullable: true })
  tenancyType: TenancyType | null

  @Column({ name: 'verification_submitted_at', type: Date, nullable: true })
  verificationSubmittedAt: Date | null

  @Column({ name: 'verification_decided_at', type: Date, nullable: true })
  verificationDecidedAt: Date | null

  @CreateDateColumn({ name: 'joined_at', type: Date })
  joinedAt: Date
}
