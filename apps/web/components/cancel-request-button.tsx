'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { cancelJoinRequest } from '@/app/groups/[id]/actions'
import { Button } from './ui'

/** Lets a requester withdraw a pending join request without a steward. */
export function CancelRequestButton({ societyId }: { societyId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await cancelJoinRequest(societyId)
            if (result.ok) router.refresh()
            else setError(result.message)
          })
        }}
      >
        Cancel request
      </Button>
      {error && (
        <p role="alert" className="text-[12.5px] text-accent">
          {error}
        </p>
      )}
    </div>
  )
}
