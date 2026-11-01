import { BadgeCheck, CircleDashed, Hourglass, ShieldAlert } from 'lucide-react'

import type { MembershipVerificationStatus } from '@/lib/recommendation-types'

const COPY: Record<MembershipVerificationStatus, { label: string; short: string }> = {
  UNVERIFIED: { label: 'Residence not verified', short: 'Unverified' },
  PENDING: { label: 'Residence claim under review', short: 'In review' },
  VERIFIED: { label: 'Residence verified', short: 'Verified' },
  REJECTED: { label: 'Residence could not be confirmed', short: 'Not confirmed' },
}

const TONE: Record<MembershipVerificationStatus, string> = {
  UNVERIFIED: 'border border-line-strong text-muted',
  PENDING: 'bg-accent-soft text-accent',
  VERIFIED: 'bg-[#4d6c51]/12 text-[#3d5a41]',
  REJECTED: 'bg-accent-soft text-accent',
}

function Icon({ status }: { status: MembershipVerificationStatus }) {
  if (status === 'VERIFIED') return <BadgeCheck className="size-3" aria-hidden />
  if (status === 'PENDING') return <Hourglass className="size-3" aria-hidden />
  if (status === 'REJECTED') return <ShieldAlert className="size-3" aria-hidden />
  return <CircleDashed className="size-3" aria-hidden />
}

/**
 * Verification is a per-society fact, so the badge always travels with the
 * group it belongs to. It never implies identity or email verification.
 */
export function VerificationStatusBadge({
  status,
  className,
}: {
  status: MembershipVerificationStatus
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ${TONE[status]} ${className ?? ''}`}
    >
      <Icon status={status} />
      {COPY[status].label}
    </span>
  )
}

export function verificationLabel(status: MembershipVerificationStatus): string {
  return COPY[status].short
}
