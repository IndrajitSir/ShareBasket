import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm'

/**
 * Residence verification state on a membership.
 *
 * Only the unit/block and tenancy type are stored: the society already carries
 * the street-level location, and no identity document, scan or raw address is
 * collected. A steward of the same society confirms the claim; see
 * `docs/RBAC_PERMISSIONS.md`.
 */
export class AddResidenceVerification1793000000007 implements MigrationInterface {
  name = 'AddResidenceVerification1793000000007'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres'
    const timestampType = isPostgres ? 'timestamp' : 'datetime'

    await queryRunner.addColumns('society_membership_detail', [
      new TableColumn({
        name: 'verification_status',
        type: 'varchar',
        length: '16',
        isNullable: false,
        default: "'UNVERIFIED'",
      }),
      new TableColumn({
        name: 'residence_block',
        type: 'varchar',
        length: '40',
        isNullable: true,
      }),
      new TableColumn({
        name: 'residence_unit',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'tenancy_type',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
      new TableColumn({
        name: 'verification_submitted_at',
        type: timestampType,
        isNullable: true,
      }),
      new TableColumn({
        name: 'verification_decided_at',
        type: timestampType,
        isNullable: true,
      }),
    ])

    await queryRunner.createIndex(
      'society_membership_detail',
      new TableIndex({
        name: 'ix_membership_society_verification',
        columnNames: ['society_id', 'verification_status'],
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'society_membership_detail',
      'ix_membership_society_verification',
    )
    await queryRunner.dropColumns('society_membership_detail', [
      'verification_status',
      'residence_block',
      'residence_unit',
      'tenancy_type',
      'verification_submitted_at',
      'verification_decided_at',
    ])
  }
}
