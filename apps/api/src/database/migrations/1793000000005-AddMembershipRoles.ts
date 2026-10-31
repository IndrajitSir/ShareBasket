import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

/**
 * Scope-aware membership roles. Existing preview memberships become MEMBER;
 * the join path promotes the first member of a society to STEWARD.
 */
export class AddMembershipRoles1793000000005 implements MigrationInterface {
  name = 'AddMembershipRoles1793000000005'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'society_membership_detail',
      new TableColumn({
        name: 'role',
        type: 'varchar',
        length: '16',
        isNullable: false,
        default: "'MEMBER'",
      }),
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('society_membership_detail', 'role')
  }
}
