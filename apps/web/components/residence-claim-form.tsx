'use client'

import { MapPin } from 'lucide-react'
import { useId, useState, useTransition } from 'react'

import { submitResidence } from '@/app/groups/[id]/actions'
import { formatClosingDate } from '@/lib/format'
import type { ResidenceClaim } from '@/lib/groups'
import type { TenancyType } from '@/lib/recommendation-types'
import { Button, inputClass } from './ui'

const TENANCY_OPTIONS: Array<{ value: TenancyType; label: string; hint: string }> = [
  { value: 'OWNER', label: 'I own it', hint: 'Owner or co-owner' },
  { value: 'TENANT', label: 'I rent it', hint: 'Lease in my name' },
  { value: 'FAMILY', label: 'Family home', hint: 'Living with the owner' },
]

/**
 * A member's own declaration. It is stored as PENDING and only a different
 * steward of the same society can verify it; this form cannot approve anything.
 * A rejected claim can be corrected and resubmitted without losing the audit
 * trail of the first attempt.
 */
export function ResidenceClaimForm({
  societyId,
  claim,
  societyName,
}: {
  societyId: string
  claim: ResidenceClaim
  societyName: string
}) {
  const fieldId = useId()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [attested, setAttested] = useState(false)
  const [unit, setUnit] = useState(claim.unit ?? '')
  const [block, setBlock] = useState(claim.block ?? '')
  const [tenancy, setTenancy] = useState<TenancyType>(claim.tenancy ?? 'OWNER')

  if (claim.status === 'PENDING') {
    return (
      <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-7">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] text-accent">
          <MapPin className="size-3.5" aria-hidden /> Waiting for a steward
        </p>
        <h2 className="font-display mt-4 text-[28px] leading-tight">Residence claim in review</h2>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
          You declared{' '}
          <span className="text-fg">
            {claim.block ? `${claim.block}, ` : ''}
            {claim.unit}
          </span>{' '}
          as a {tenancyWord(claim.tenancy)} in {societyName}
          {claim.submittedAt ? ` on ${formatClosingDate(claim.submittedAt, 'long')}` : ''}. A
          different steward of this group has to confirm it; stewards cannot review their own
          claim.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
          Only stewards of this group can see these details. Other members only ever see that your
          residence is verified, never your address.
        </p>
      </div>
    )
  }

  if (claim.status === 'VERIFIED') {
    return (
      <div className="rounded-[22px] border border-[#4d6c51]/25 bg-[#4d6c51]/8 p-6 sm:p-7">
        <p className="inline-flex items-center gap-2 text-[12.5px] text-[#3d5a41]">
          <MapPin className="size-3.5" aria-hidden /> Residence verified
        </p>
        <h2 className="font-display mt-3 text-[26px] leading-tight">
          {claim.block ? `${claim.block}, ` : ''}
          {claim.unit}
        </h2>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted">
          A steward confirmed this address as your {tenancyWord(claim.tenancy)} tenure in{' '}
          {societyName}
          {claim.decidedAt ? ` on ${formatClosingDate(claim.decidedAt, 'long')}` : ''}. It stays
          visible only to you and the stewards of this group.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-7">
      <p className="inline-flex items-center gap-2 text-[12.5px] text-muted">
        <MapPin className="size-3.5" aria-hidden /> Residence verification
      </p>
      <h2 className="font-display mt-2 text-[28px] leading-tight">
        {claim.status === 'REJECTED' ? 'Check your details and try again' : 'Confirm where you live'}
      </h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
        {claim.status === 'REJECTED'
          ? 'A steward could not confirm the details you sent. Correct the block, unit or tenure below; the earlier attempt stays in the group’s audit trail.'
          : `Verification is per group. Share your block and unit so a steward of ${societyName} can confirm you live there. This is separate from email verification and grants no extra powers.`}
      </p>

      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setError(null)
          if (!attested) {
            setError('Confirm that these residence details are yours.')
            return
          }
          startTransition(async () => {
            const result = await submitResidence({
              societyId,
              block: block || undefined,
              unit,
              tenancy,
              attested,
            })
            if (!result.ok) setError(result.message)
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label htmlFor={`${fieldId}-block`} className="text-[12.5px] text-muted">
              Block or tower <span className="text-faint">(optional)</span>
            </label>
            <input
              id={`${fieldId}-block`}
              name="block"
              value={block}
              onChange={(event) => setBlock(event.target.value)}
              autoComplete="address-line2"
              maxLength={40}
              placeholder="Tower B"
              className={`${inputClass} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-unit`} className="text-[12.5px] text-muted">
              Unit or house number
            </label>
            <input
              id={`${fieldId}-unit`}
              name="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              autoComplete="address-line1"
              maxLength={20}
              required
              placeholder="402"
              aria-describedby={`${fieldId}-unit-hint`}
              className={`${inputClass} mt-1.5`}
            />
            <p id={`${fieldId}-unit-hint`} className="mt-1.5 text-[12px] text-faint">
              Letters, numbers, spaces, dots, slashes and dashes.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="text-[12.5px] text-muted">How do you occupy the home?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {TENANCY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col rounded-[14px] border px-3.5 py-3 text-[13.5px] transition-colors ${
                  tenancy === option.value
                    ? 'border-fg bg-surface-2'
                    : 'border-line-strong hover:border-fg'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tenancy"
                    value={option.value}
                    checked={tenancy === option.value}
                    onChange={() => setTenancy(option.value)}
                    className="size-3.5 accent-[var(--color-fg)]"
                  />
                  {option.label}
                </span>
                <span className="mt-1 pl-5 text-[12px] text-faint">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-2/50 px-3.5 py-3 text-[13px] leading-relaxed">
          <input
            type="checkbox"
            checked={attested}
            onChange={(event) => setAttested(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-fg)]"
            aria-describedby={`${fieldId}-attest-hint`}
          />
          <span>
            I confirm these are my own residence details and that a steward may check them with the
            group.
            <span id={`${fieldId}-attest-hint`} className="mt-0.5 block text-[12px] text-faint">
              A false claim can be rejected, and the decision is recorded in the audit trail.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" loading={pending}>
            Submit for review
          </Button>
          <p className="text-[12px] text-faint">You can correct a rejected claim and try again.</p>
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-accent">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}

function tenancyWord(tenancy: TenancyType | null): string {
  if (tenancy === 'TENANT') return 'rented'
  if (tenancy === 'FAMILY') return 'family'
  return 'owned'
}
