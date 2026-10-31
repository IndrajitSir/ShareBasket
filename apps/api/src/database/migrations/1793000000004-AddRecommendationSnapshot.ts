import { MigrationInterface, QueryRunner, Table } from 'typeorm'

/**
 * Persisted, session-independent recommendation summary. Rebuilding writes one
 * row per scope, so the table stays small and needs no cleanup job.
 */
export class AddRecommendationSnapshot1793000000004 implements MigrationInterface {
  name = 'AddRecommendationSnapshot1793000000004'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType = queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime'

    await queryRunner.createTable(
      new Table({
        name: 'recommendation_snapshot',
        columns: [
          { name: 'scope', type: 'varchar', length: '40', isPrimary: true },
          { name: 'payload', type: 'text', isNullable: false },
          { name: 'computed_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
          { name: 'version', type: 'int', isNullable: false, default: 1 },
        ],
        checks: [{ name: 'ck_recommendation_snapshot_version', expression: 'version >= 1' }],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('recommendation_snapshot', true)
  }
}
