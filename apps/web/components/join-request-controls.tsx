'use client'

import { Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { decideJoinRequest } from '@/app/groups/[id]/actions'
import { Button } from './ui'

/**
 * Shown only to a steward of this society. The buttons are convenience: the API
 * re-checks that the caller is an active steward of this same society.
 */
export function JoinRequestControls({
  societyId,
  userId,
  name,
}: {
  societyId: string
  userId: string
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function decide(decision: 'approve' | 'reject') {
    setError(null)
    setAction(decision)
    startTransition(async () => {
      const result = await decideJoinRequest({ societyId, userId, decision })
      setAction(null)
      if (!result.ok) setError(result.message)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        loading={pending && action === 'approve'}
        disabled={pending}
        aria-label={`Approve ${name}'s request`}
        onClick={() => decide('approve')}
      >
        <Check aria-hidden /> Approve
      </Button>
      <Button
        size="sm"
        variant="secondary"
        loading={pending && action === 'reject'}
        disabled={pending}
        aria-label={`Decline ${name}'s request`}
        onClick={() => decide('reject')}
      >
        <X aria-hidden /> Decline
      </Button>
      {error && (
        <p role="alert" className="text-[12.5px] text-accent">
          {error}
        </p>
      )}
    </div>
  )
}
