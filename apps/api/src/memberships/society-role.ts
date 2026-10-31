/**
 * Roles a member can hold inside one society. Authorization is scope-aware:
 * the role only applies to the society in the membership row, never globally.
 */
export const SOCIETY_ROLES = ['MEMBER', 'STEWARD'] as const

export type SocietyRole = (typeof SOCIETY_ROLES)[number]

export const ROLE_RANK: Record<SocietyRole, number> = { MEMBER: 1, STEWARD: 2 }

export function isSocietyRole(value: unknown): value is SocietyRole {
  return typeof value === 'string' && (SOCIETY_ROLES as readonly string[]).includes(value)
}

export function hasSocietyRole(actual: SocietyRole, required: SocietyRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required]
}
