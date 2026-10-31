import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm'

/**
 * Recommendation foundation: coarse society coordinates, immediate preview
 * membership and implicit quote signals. Raw user coordinates are never stored.
 */
export class AddRecommendations1793000000002 implements MigrationInterface {
  name = 'AddRecommendations1793000000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType = queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime'

    await queryRunner.addColumns('society_master', [
      new TableColumn({ name: 'latitude', type: 'float', isNullable: true }),
      new TableColumn({ name: 'longitude', type: 'float', isNullable: true }),
    ])

    await queryRunner.createTable(
      new Table({
        name: 'society_membership_detail',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'society_id', type: 'uuid', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false, default: "'ACTIVE'" },
          { name: 'joined_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({
            name: 'uq_society_membership',
            columnNames: ['user_id', 'society_id'],
            isUnique: true,
          }),
          new TableIndex({ name: 'ix_membership_society', columnNames: ['society_id'] }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_membership_user',
            columnNames: ['user_id'],
            referencedTableName: 'user_master',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'fk_membership_society',
            columnNames: ['society_id'],
            referencedTableName: 'society_master',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    )

    await queryRunner.createTable(
      new Table({
        name: 'user_campaign_signal_detail',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'user_id', type: 'uuid', isNullable: false },
          { name: 'campaign_id', type: 'uuid', isNullable: false },
          { name: 'signal_type', type: 'varchar', length: '20', isNullable: false, default: "'QUOTE'" },
          { name: 'weight', type: 'int', isNullable: false },
          { name: 'created_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        checks: [
          { name: 'ck_signal_weight_positive', expression: 'weight >= 1' },
          { name: 'ck_signal_type', expression: "signal_type = 'QUOTE'" },
        ],
        indices: [
          new TableIndex({ name: 'ix_signal_user', columnNames: ['user_id'] }),
          new TableIndex({ name: 'ix_signal_campaign', columnNames: ['campaign_id'] }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_signal_user',
            columnNames: ['user_id'],
            referencedTableName: 'user_master',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'fk_signal_campaign',
            columnNames: ['campaign_id'],
            referencedTableName: 'campaign_master',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_campaign_signal_detail', true)
    await queryRunner.dropTable('society_membership_detail', true)
    await queryRunner.dropColumns('society_master', ['latitude', 'longitude'])
  }
}
