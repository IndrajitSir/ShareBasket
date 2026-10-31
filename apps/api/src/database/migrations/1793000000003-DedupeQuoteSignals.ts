import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm'

import { CampaignSignal } from '../entities/campaign-signal.entity'

const DELETE_CHUNK = 400

/**
 * One implicit quote signal per member and campaign. Repeated quotes update
 * that signal instead of adding rows, so a single member cannot inflate a
 * campaign's peer weight by quoting repeatedly.
 *
 * Previously recorded duplicates are collapsed to the highest quoted quantity
 * before the unique index is created.
 */
export class DedupeQuoteSignals1793000000003 implements MigrationInterface {
  name = 'DedupeQuoteSignals1793000000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const signals = queryRunner.manager.getRepository(CampaignSignal)
    const rows = await signals.find({
      select: { id: true, userId: true, campaignId: true, weight: true },
    })

    const kept = new Map<string, { id: string; weight: number }>()
    const remove: string[] = []
    for (const row of rows) {
      const key = `${row.userId}:${row.campaignId}`
      const current = kept.get(key)
      if (!current) {
        kept.set(key, { id: row.id, weight: row.weight })
      } else if (row.weight > current.weight) {
        remove.push(current.id)
        kept.set(key, { id: row.id, weight: row.weight })
      } else {
        remove.push(row.id)
      }
    }

    for (let index = 0; index < remove.length; index += DELETE_CHUNK) {
      await signals.delete(remove.slice(index, index + DELETE_CHUNK))
    }

    // The unique index also serves user-scoped lookups, so the old single-column
    // user index is redundant.
    await queryRunner.dropIndex('user_campaign_signal_detail', 'ix_signal_user')
    await queryRunner.createIndex(
      'user_campaign_signal_detail',
      new TableIndex({
        name: 'uq_signal_user_campaign',
        columnNames: ['user_id', 'campaign_id'],
        isUnique: true,
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('user_campaign_signal_detail', 'uq_signal_user_campaign')
    await queryRunner.createIndex(
      'user_campaign_signal_detail',
      new TableIndex({ name: 'ix_signal_user', columnNames: ['user_id'] }),
    )
  }
}
