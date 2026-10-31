'use server'

import { revalidatePath } from 'next/cache'

import { changeGroupMemberRole } from '@/lib/groups'
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
