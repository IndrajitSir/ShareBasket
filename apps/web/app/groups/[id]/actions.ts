'use server'

import { revalidatePath } from 'next/cache'

import {
  cancelGroupRequest,
  changeGroupMemberRole,
  decideGroupRequest,
} from '@/lib/groups'
import type { SocietyRole } from '@/lib/recommendation-types'

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
