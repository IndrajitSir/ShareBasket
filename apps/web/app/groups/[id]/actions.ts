'use server'

import { revalidatePath } from 'next/cache'

import {
  cancelGroupRequest,
  changeGroupMemberRole,
  decideGroupRequest,
  decideGroupResidence,
  submitGroupResidence,
} from '@/lib/groups'
import type { SocietyRole, TenancyType } from '@/lib/recommendation-types'

const LABEL = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/
const TENANCIES: readonly TenancyType[] = ['OWNER', 'TENANT', 'FAMILY']

/**
 * The browser only names the target and the desired role. The API re-derives
 * the caller's role from their membership row, so this action can never grant
 * a role the signed-in account does not already have the right to assign.
 */
export async function setMemberRole(input: {
  societyId: string
  userId: string
  role: SocietyRole
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await changeGroupMemberRole(input.societyId, input.userId, input.role)
  if (result.ok) {
    revalidatePath(`/groups/${input.societyId}`)
    revalidatePath('/for-you')
    revalidatePath('/account')
  }
  return result
}

/** Steward decision on one pending request; the API enforces the same rule. */
export async function decideJoinRequest(input: {
  societyId: string
  userId: string
  decision: 'approve' | 'reject'
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await decideGroupRequest(input.societyId, input.userId, input.decision)
  if (result.ok) {
    revalidatePath(`/groups/${input.societyId}`)
    revalidatePath('/for-you')
    revalidatePath('/account')
  }
  return result
}

/**
 * The browser supplies a declaration, never an approval. The API re-checks the
 * membership, rejects self-review and writes the audit event, so this action
 * cannot verify anyone by itself.
 */
export async function submitResidence(input: {
  societyId: string
  block?: string
  unit: string
  tenancy: TenancyType
  attested: boolean
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const unit = input.unit.trim()
  const block = input.block?.trim() || undefined

  if (!LABEL.test(unit) || unit.length > 20) {
    return { ok: false, message: 'Enter a unit or house number using letters or numbers.' }
  }
  if (block && (!LABEL.test(block) || block.length > 40)) {
    return { ok: false, message: 'Enter a shorter block or tower name.' }
  }
  if (!TENANCIES.includes(input.tenancy)) {
    return { ok: false, message: 'Choose how you occupy the home.' }
  }
  if (!input.attested) {
    return { ok: false, message: 'Confirm that these residence details are yours.' }
  }

  const result = await submitGroupResidence(input.societyId, { block, unit, tenancy: input.tenancy })
  if (result.ok) {
    revalidatePath(`/groups/${input.societyId}`)
    revalidatePath('/account')
  }
  return result
}

/** Steward-only; the API enforces the role and blocks self-review. */
export async function decideResidence(input: {
  societyId: string
  userId: string
  decision: 'verify' | 'reject'
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await decideGroupResidence(input.societyId, input.userId, input.decision)
  if (result.ok) {
    revalidatePath(`/groups/${input.societyId}`)
    revalidatePath('/account')
  }
  return result
}

/** Withdraws the signed-in account's own pending request. */
export async function cancelJoinRequest(
  societyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await cancelGroupRequest(societyId)
  if (result.ok) {
    revalidatePath(`/groups/${societyId}`)
    revalidatePath('/for-you')
    revalidatePath('/account')
  }
  return result
}
