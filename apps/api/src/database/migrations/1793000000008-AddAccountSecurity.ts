import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * Account security state: email verification timestamp, optional TOTP MFA,
 * and fingerprints of the most recent purpose tokens so verification and
 * reset links are single use even without a token table.
 */
export class AddAccountSecurity1793000000008 implements MigrationInterface {
  name = 'AddAccountSecurity1793000000008'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType = queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime'

    await queryRunner.addColumns('user_master', [
      new TableColumn({
        name: 'email_verified_at',
        type: timestampType,
        isNullable: true,
      }),
      new TableColumn({
        name: 'mfa_secret',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      // False while enrollment is staged; the secret only gates login after
      // one valid TOTP code confirmed the authenticator round-trip.
      new TableColumn({
        name: 'mfa_confirmed',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'mfa_last_used_at',
        type: timestampType,
        isNullable: true,
      }),
      new TableColumn({
        name: 'verify_token_fingerprint',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'reset_token_fingerprint',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    ])
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('user_master', [
      'email_verified_at',
      'mfa_secret',
      'mfa_confirmed',
      'mfa_last_used_at',
      'verify_token_fingerprint',
      'reset_token_fingerprint',
    ])
  }
}
