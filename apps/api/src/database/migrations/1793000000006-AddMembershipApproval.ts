import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm'

/**
 * Pending membership approval plus an append-only audit trail.
 *
 * The status column already exists and accepts the new `PENDING` value, so the
 * schema change here is the audit table, a covering index for pending-request
 * lookups, and database triggers that make the audit trail genuinely
 * append-only. Application code only ever inserts, but a trigger also protects
 * against a future query or a manual statement.
 */
export class AddMembershipApproval1793000000006 implements MigrationInterface {
  name = 'AddMembershipApproval1793000000006'

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres'
    const timestampType = isPostgres ? 'timestamp' : 'datetime'

    // A membership row is a request unless something explicitly activates it,
    // so the column default moves from ACTIVE to the safer PENDING.
    await queryRunner.changeColumn(
      'society_membership_detail',
      'status',
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '16',
        isNullable: false,
        default: "'PENDING'",
      }),
    )

    await queryRunner.createTable(
      new Table({
        name: 'society_audit_event',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'society_id', type: 'uuid', isNullable: false },
          { name: 'actor_user_id', type: 'uuid', isNullable: true },
          { name: 'actor_name', type: 'varchar', length: '120', isNullable: true },
          { name: 'action', type: 'varchar', length: '32', isNullable: false },
          { name: 'target_user_id', type: 'uuid', isNullable: false },
          { name: 'target_name', type: 'varchar', length: '120', isNullable: false },
          { name: 'from_status', type: 'varchar', length: '16', isNullable: true },
          { name: 'to_status', type: 'varchar', length: '16', isNullable: true },
          { name: 'from_role', type: 'varchar', length: '16', isNullable: true },
          { name: 'to_role', type: 'varchar', length: '16', isNullable: true },
          { name: 'created_at', type: timestampType, isNullable: false, default: 'CURRENT_TIMESTAMP' },
        ],
        uniques: [],
        indices: [
          new TableIndex({
            name: 'ix_audit_society_created',
            columnNames: ['society_id', 'created_at'],
          }),
        ],
      }),
      true,
    )

    await queryRunner.createIndex(
      'society_membership_detail',
      new TableIndex({
        name: 'ix_membership_society_status',
        columnNames: ['society_id', 'status'],
      }),
    )

    if (isPostgres) {
      await queryRunner.query(`
        CREATE OR REPLACE FUNCTION society_audit_event_immutable()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'society_audit_event is append-only';
        END;
        $$ LANGUAGE plpgsql
      `)
      await queryRunner.query(`
        CREATE TRIGGER trg_society_audit_event_immutable
        BEFORE UPDATE OR DELETE ON society_audit_event
        FOR EACH ROW EXECUTE FUNCTION society_audit_event_immutable()
      `)
    } else {
      await queryRunner.query(`
        CREATE TRIGGER trg_society_audit_event_no_update
        BEFORE UPDATE ON society_audit_event
        BEGIN
          SELECT RAISE(ABORT, 'society_audit_event is append-only');
        END
      `)
      await queryRunner.query(`
        CREATE TRIGGER trg_society_audit_event_no_delete
        BEFORE DELETE ON society_audit_event
        BEGIN
          SELECT RAISE(ABORT, 'society_audit_event is append-only');
        END
      `)
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres'

    if (isPostgres) {
      await queryRunner.query('DROP TRIGGER IF EXISTS trg_society_audit_event_immutable ON society_audit_event')
      await queryRunner.query('DROP FUNCTION IF EXISTS society_audit_event_immutable()')
    } else {
      await queryRunner.query('DROP TRIGGER IF EXISTS trg_society_audit_event_no_update')
      await queryRunner.query('DROP TRIGGER IF EXISTS trg_society_audit_event_no_delete')
    }

    await queryRunner.dropIndex('society_membership_detail', 'ix_membership_society_status')
    await queryRunner.dropTable('society_audit_event', true)
  }
}
