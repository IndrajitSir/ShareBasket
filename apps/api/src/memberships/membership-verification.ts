/**
 * Residence verification is a separate decision from membership approval.
 *
 * `UNVERIFIED` — no claim has been made.
 * `PENDING`    — the member declared a block/unit and tenancy; a steward must review it.
 * `VERIFIED`   — a steward of that same society confirmed the claim.
 * `REJECTED`   — the claim was not accepted; the member may submit a corrected one.
 */
export const MEMBERSHIP_VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const

export type MembershipVerificationStatus = (typeof MEMBERSHIP_VERIFICATION_STATUSES)[number]

/** How the member occupies the unit. Attested by the member, confirmed by a steward. */
export const TENANCY_TYPES = ['OWNER', 'TENANT', 'FAMILY'] as const

export type TenancyType = (typeof TENANCY_TYPES)[number]

export function isTenancyType(value: unknown): value is TenancyType {
  return typeof value === 'string' && (TENANCY_TYPES as readonly string[]).includes(value)
}

export function isMembershipVerificationStatus(
  value: unknown,
): value is MembershipVerificationStatus {
  return (
    typeof value === 'string' &&
    (MEMBERSHIP_VERIFICATION_STATUSES as readonly string[]).includes(value)
  )
}
