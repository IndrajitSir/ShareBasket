/**
 * Every authorization-relevant membership transition. The audit table is
 * append-only at the database level, so this list is the complete vocabulary
 * and no action may be edited once written.
 */
export const SOCIETY_AUDIT_ACTIONS = [
  'MEMBERSHIP_REQUESTED',
  'MEMBERSHIP_APPROVED',
  'MEMBERSHIP_REJECTED',
  'MEMBERSHIP_LEFT',
  'ROLE_CHANGED',
  'STEWARD_BOOTSTRAPPED',
  'STEWARD_SUCCEEDED',
] as const

export type SocietyAuditAction = (typeof SOCIETY_AUDIT_ACTIONS)[number]

export function isSocietyAuditAction(value: unknown): value is SocietyAuditAction {
  return typeof value === 'string' && (SOCIETY_AUDIT_ACTIONS as readonly string[]).includes(value)
}
