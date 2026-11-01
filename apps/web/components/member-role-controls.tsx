'use client'

import { useState, useTransition } from 'react'

import { setMemberRole } from '@/app/groups/[id]/actions'
import type { SocietyRole } from '@/lib/recommendation-types'
import { Button } from './ui'

/**
 * Shown only to a steward of this society. Buttons are UX: the API rejects the
 * change for anyone whose membership row is not STEWARD in this same society.
 */
export function MemberRoleControls({
  societyId,
  userId,
  role,
  name,
}: {
  societyId: string
  userId: string
  role: SocietyRole
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const nextRole: SocietyRole = role === 'STEWARD' ? 'MEMBER' : 'STEWARD'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        aria-label={
          nextRole === 'STEWARD'
            ? `Make ${name} a steward of this group`
            : `Change ${name} to a member of this group`
        }
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const result = await setMemberRole({ societyId, userId, role: nextRole })
            if (!result.ok) setError(result.message)
          })
        }
      >
        {nextRole === 'STEWARD' ? 'Make steward' : 'Make member'}
      </Button>
      {error && (
        <p role="alert" className="text-[12.5px] text-accent">
          {error}
        </p>
      )}
    </div>
  )
}
