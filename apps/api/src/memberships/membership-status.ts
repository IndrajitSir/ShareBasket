/**
 * A membership is a request until a steward of that society admits it.
 * Only `ACTIVE` rows grant any access; `PENDING` rows are visible to the
 * requesting account and to stewards of the same society.
 */
export const MEMBERSHIP_STATUSES = ['PENDING', 'ACTIVE'] as const

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

export function isMembershipStatus(value: unknown): value is MembershipStatus {
  return typeof value === 'string' && (MEMBERSHIP_STATUSES as readonly string[]).includes(value)
}
