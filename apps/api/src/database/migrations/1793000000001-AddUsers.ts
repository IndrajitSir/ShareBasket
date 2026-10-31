import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm'

/**
 * Account foundation for email/password and OAuth sign-in. Session JWTs are
 * stateless and are not stored here.
 */
export class AddUsers1793000000001 implements MigrationInterface {
  name = 'AddUsers1793000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType = queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime'

    await queryRunner.createTable(
      new Table({
        name: 'user_master',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'email', type: 'varchar', length: '254', isNullable: false },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'password_hash', type: 'varchar', length: '100', isNullable: true },
          { name: 'avatar_url', type: 'varchar', length: '500', isNullable: true },
          { name: 'oauth_provider', type: 'varchar', length: '20', isNullable: false, default: "'local'" },
          { name: 'oauth_subject', type: 'varchar', length: '191', isNullable: true },
          { name: 'created_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        indices: [
          new TableIndex({ name: 'uq_user_master_email', columnNames: ['email'], isUnique: true }),
          new TableIndex({
            name: 'uq_user_oauth_identity',
            columnNames: ['oauth_provider', 'oauth_subject'],
            isUnique: true,
          }),
        ],
      }),
      true,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_master', true)
  }
}
