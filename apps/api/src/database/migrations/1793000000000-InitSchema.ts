import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm'

/**
 * Initial read-only schema: catalogue and campaign master/detail tables.
 * Types are driver-neutral so the same migration runs on PostgreSQL in
 * deployment and SQLite locally/in tests.
 */
export class InitSchema1793000000000 implements MigrationInterface {
  name = 'InitSchema1793000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM normalises entity `Date` columns per driver;
    // the migration must make the same choice explicitly.
    const timestampType = queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime'

    await queryRunner.createTable(
      new Table({
        name: 'category_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'key', type: 'varchar', length: '40', isNullable: false },
          { name: 'label', type: 'varchar', length: '80', isNullable: false },
          { name: 'blurb', type: 'varchar', length: '160', isNullable: false },
          { name: 'image', type: 'varchar', length: '255', isNullable: false },
          { name: 'sort_order', type: 'int', isNullable: false },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'category_master',
      new TableIndex({ name: 'uq_category_master_key', columnNames: ['key'], isUnique: true }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'society_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'location', type: 'varchar', length: '120', isNullable: false },
        ],
      }),
      true,
    )
    await queryRunner.createIndex(
      'society_master',
      new TableIndex({ name: 'uq_society_master_name', columnNames: ['name'], isUnique: true }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'product_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'slug', type: 'varchar', length: '80', isNullable: false },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'category_id', type: 'uuid', isNullable: false },
          { name: 'price_paise', type: 'int', isNullable: false },
          { name: 'compare_at_paise', type: 'int', isNullable: true },
          { name: 'image', type: 'varchar', length: '255', isNullable: false },
          { name: 'badge', type: 'varchar', length: '40', isNullable: true },
          { name: 'short_description', type: 'varchar', length: '200', isNullable: false },
          { name: 'description', type: 'text', isNullable: false },
          { name: 'details_json', type: 'text', isNullable: false },
          { name: 'materials', type: 'text', isNullable: false },
          { name: 'option_name', type: 'varchar', length: '40', isNullable: true },
          { name: 'option_values_json', type: 'text', isNullable: true },
          { name: 'featured', type: 'boolean', isNullable: false },
          { name: 'created_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        checks: [
          { name: 'ck_product_price_nonnegative', expression: 'price_paise >= 0' },
          {
            name: 'ck_product_compare_price',
            expression: 'compare_at_paise IS NULL OR compare_at_paise >= 0',
          },
        ],
        indices: [
          new TableIndex({ name: 'uq_product_master_slug', columnNames: ['slug'], isUnique: true }),
          new TableIndex({ name: 'ix_product_category', columnNames: ['category_id'] }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_product_category',
            columnNames: ['category_id'],
            referencedTableName: 'category_master',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    )

    await queryRunner.createTable(
      new Table({
        name: 'campaign_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'slug', type: 'varchar', length: '80', isNullable: false },
          { name: 'society_id', type: 'uuid', isNullable: false },
          { name: 'units_committed', type: 'int', isNullable: false },
          { name: 'minimum_units', type: 'int', isNullable: false },
          { name: 'closes_at', type: timestampType, isNullable: false },
          { name: 'delivery_date', type: 'date', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false, default: "'OPEN'" },
          { name: 'created_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        checks: [
          { name: 'ck_campaign_units_nonnegative', expression: 'units_committed >= 0' },
          { name: 'ck_campaign_minimum_positive', expression: 'minimum_units >= 1' },
        ],
        indices: [
          new TableIndex({ name: 'uq_campaign_master_slug', columnNames: ['slug'], isUnique: true }),
          new TableIndex({ name: 'ix_campaign_society', columnNames: ['society_id'] }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_campaign_society',
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
        name: 'campaign_product_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'campaign_id', type: 'uuid', isNullable: false },
          { name: 'product_id', type: 'uuid', isNullable: false },
        ],
        indices: [
          new TableIndex({
            name: 'uq_campaign_product',
            columnNames: ['campaign_id', 'product_id'],
            isUnique: true,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_campaign_product_campaign',
            columnNames: ['campaign_id'],
            referencedTableName: 'campaign_master',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            name: 'fk_campaign_product_product',
            columnNames: ['product_id'],
            referencedTableName: 'product_master',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    )

    await queryRunner.createTable(
      new Table({
        name: 'campaign_price_tier_detail',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'campaign_id', type: 'uuid', isNullable: false },
          { name: 'minimum_units', type: 'int', isNullable: false },
          { name: 'unit_price_paise', type: 'int', isNullable: false },
        ],
        checks: [
          { name: 'ck_tier_minimum_positive', expression: 'minimum_units >= 1' },
          { name: 'ck_tier_price_positive', expression: 'unit_price_paise > 0' },
        ],
        indices: [
          new TableIndex({
            name: 'uq_campaign_tier_minimum',
            columnNames: ['campaign_id', 'minimum_units'],
            isUnique: true,
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_tier_campaign',
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
    await queryRunner.dropTable('campaign_price_tier_detail', true)
    await queryRunner.dropTable('campaign_product_master', true)
    await queryRunner.dropTable('campaign_master', true)
    await queryRunner.dropTable('product_master', true)
    await queryRunner.dropTable('society_master', true)
    await queryRunner.dropTable('category_master', true)
  }
}
