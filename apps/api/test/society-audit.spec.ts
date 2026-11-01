import { DataSource } from 'typeorm'

import { entities, migrations } from '../src/database/database-options'
import { SocietyAuditEvent } from '../src/database/entities/society-audit-event.entity'
import { SocietyMembership } from '../src/database/entities/society-membership.entity'
import { Society } from '../src/database/entities/society.entity'
import { User } from '../src/database/entities/user.entity'

/**
 * Proves the audit trail is append-only in the schema itself, not just by
 * convention in the service. A future query, script or manual statement cannot
 * rewrite history.
 */
describe('Society audit trail (SQLite, migrated schema)', () => {
  let dataSource: DataSource
  let societyId: string
  let userId: string

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities,
      migrations,
      migrationsRun: true,
      synchronize: false,
    })
    await dataSource.initialize()

    const society = await dataSource.getRepository(Society).save(
      dataSource.getRepository(Society).create({
        name: 'Audit Test Society',
        location: 'Bengaluru · Audit',
        latitude: 12.9,
        longitude: 77.6,
      }),
    )
    societyId = society.id

    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: 'audit@example.com',
        name: 'Audit Member',
        passwordHash: null,
        avatarUrl: null,
        oauthProvider: 'local',
        oauthSubject: null,
      }),
    )
    userId = user.id
  })

  afterAll(async () => {
    await dataSource.destroy()
  })

  it('defaults a membership inserted without a status to PENDING', async () => {
    const row = await dataSource.getRepository(SocietyMembership).save(
      dataSource.getRepository(SocietyMembership).create({ userId, societyId }),
    )

    expect(row.status).toBe('PENDING')
  })

  it('accepts new audit events and keeps their snapshotted names', async () => {
    const repository = dataSource.getRepository(SocietyAuditEvent)
    await repository.save(
      repository.create({
        societyId,
        actorUserId: userId,
        actorName: 'Audit Member',
        action: 'MEMBERSHIP_REQUESTED',
        targetUserId: userId,
        targetName: 'Audit Member',
        fromStatus: null,
        toStatus: 'PENDING',
        fromRole: null,
        toRole: 'MEMBER',
      }),
    )

    const [stored] = await repository.find({ where: { societyId } })
    expect(stored).toMatchObject({
      action: 'MEMBERSHIP_REQUESTED',
      targetName: 'Audit Member',
      toStatus: 'PENDING',
    })
    expect(stored.createdAt).toBeInstanceOf(Date)
  })

  it('rejects an UPDATE of an existing audit event', async () => {
    await expect(
      dataSource.query("UPDATE society_audit_event SET target_name = 'Rewritten' WHERE society_id = ?", [
        societyId,
      ]),
    ).rejects.toThrow(/append-only/i)

    const [stored] = await dataSource.getRepository(SocietyAuditEvent).find({ where: { societyId } })
    expect(stored.targetName).toBe('Audit Member')
  })

  it('rejects a DELETE of an existing audit event', async () => {
    await expect(
      dataSource.query('DELETE FROM society_audit_event WHERE society_id = ?', [societyId]),
    ).rejects.toThrow(/append-only/i)

    const rows = await dataSource.getRepository(SocietyAuditEvent).find({ where: { societyId } })
    expect(rows).toHaveLength(1)
  })
})
