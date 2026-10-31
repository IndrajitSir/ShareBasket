import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Last computed recommendation summary. One row per scope keeps the table tiny
 * and portable; the JSON holds trending order and item-item affinity edges.
 */
@Entity('recommendation_snapshot')
export class RecommendationSnapshotRow {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  scope: string

  @Column({ type: 'text' })
  payload: string

  @Column({ name: 'computed_at', type: Date })
  computedAt: Date

  @Column({ type: 'int', default: 1 })
  version: number
}
