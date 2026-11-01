'use client'

import { Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { decideResidence } from '@/app/groups/[id]/actions'
import { Button } from './ui'

/**
 * Steward-only controls for a pending residence claim. The API re-checks the
 * caller's role in this society and refuses self-review, so hiding these for
 * members is convenience rather than the security boundary.
 */
export function ResidenceReviewControls({
  societyId,
  userId,
  name,
}: {
  societyId: string
  userId: string
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState<'verify' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function decide(decision: 'verify' | 'reject') {
    setError(null)
    setAction(decision)
    startTransition(async () => {
      const result = await decideResidence({ societyId, userId, decision })
      setAction(null)
      if (!result.ok) setError(result.message)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        loading={pending && action === 'verify'}
        disabled={pending}
        aria-label={`Verify ${name}'s residence`}
        onClick={() => decide('verify')}
      >
        <Check aria-hidden /> Verify
      </Button>
      <Button
        size="sm"
        variant="secondary"
        loading={pending && action === 'reject'}
        disabled={pending}
        aria-label={`Reject ${name}'s residence claim`}
        onClick={() => decide('reject')}
      >
        <X aria-hidden /> Reject
      </Button>
      {error && (
        <p role="alert" className="text-[12.5px] text-accent">
          {error}
        </p>
      )}
    </div>
  )
}
