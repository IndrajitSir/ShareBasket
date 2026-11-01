import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

import type { MembershipStatus } from '../../memberships/membership-status'
import type { SocietyRole } from '../../memberships/society-role'
import type { SocietyAuditAction } from '../../memberships/society-audit-action'

/**
 * Append-only record of who changed whose membership, and why. There are no
 * update or delete paths in the application, and migration 1793000000006 adds
 * database triggers that reject both outright.
 *
 * There is deliberately no foreign key to `user_master`: an audit trail must
 * survive account deletion, so the display names are snapshotted at write time
 * and the ids are kept as opaque references.
 */
@Entity('society_audit_event')
@Index('ix_audit_society_created', ['societyId', 'createdAt'])
export class SocietyAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'society_id', type: 'uuid' })
  societyId: string

  /** Null for automatic transitions, such as steward succession. */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null

  @Column({ name: 'actor_name', type: 'varchar', length: 120, nullable: true })
  actorName: string | null

  @Column({ name: 'action', type: 'varchar', length: 32 })
  action: SocietyAuditAction

  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId: string

  @Column({ name: 'target_name', type: 'varchar', length: 120 })
  targetName: string

  @Column({ name: 'from_status', type: 'varchar', length: 16, nullable: true })
  fromStatus: MembershipStatus | null

  @Column({ name: 'to_status', type: 'varchar', length: 16, nullable: true })
  toStatus: MembershipStatus | null

  @Column({ name: 'from_role', type: 'varchar', length: 16, nullable: true })
  fromRole: SocietyRole | null

  @Column({ name: 'to_role', type: 'varchar', length: 16, nullable: true })
  toRole: SocietyRole | null

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date
}
