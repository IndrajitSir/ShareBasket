'use client'

import { Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { postQuote, type CampaignQuote } from '@/lib/api'

const MAX_UNITS_PER_QUOTE = 20

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; quote: CampaignQuote }
  | { status: 'error'; message: string }

export function CampaignQuotePanel({ slug }: { slug: string }) {
  const [quantity, setQuantity] = useState(1)
  const [state, setState] = useState<State>({ status: 'idle' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })

    postQuote(slug, quantity)
      .then((quote) => {
        if (active) setState({ status: 'ready', quote })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to price this quantity.',
        })
      })

    return () => {
      active = false
    }
  }, [quantity, slug])

  const step = (delta: number) =>
    setQuantity((current) => Math.min(MAX_UNITS_PER_QUOTE, Math.max(1, current + delta)))

  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[24px]">Price my quantity</h2>
        <span className="text-[12px] text-muted">API quote · no commitment</span>
      </div>
      <p className="mt-1 text-[13px] text-muted">The whole line is priced at the tier its units reach, including units already committed.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-control border border-line-strong">
          <button type="button" onClick={() => step(-1)} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-11 place-items-center rounded-l-control hover:bg-surface-2 disabled:opacity-40">
            <Minus className="size-4" />
          </button>
          <span aria-live="polite" className="w-14 text-center text-[15px] font-medium tabular-nums">{quantity}</span>
          <button type="button" onClick={() => step(1)} disabled={quantity >= MAX_UNITS_PER_QUOTE} aria-label="Increase quantity" className="grid size-11 place-items-center rounded-r-control hover:bg-surface-2 disabled:opacity-40">
            <Plus className="size-4" />
          </button>
        </div>
        <span className="text-[13px] text-muted">units · max {MAX_UNITS_PER_QUOTE} per household</span>
      </div>

      <div aria-live="polite" className="mt-4 min-h-[74px] rounded-control bg-surface-2 px-4 py-3">
        {state.status === 'loading' && <p className="text-[14px] text-muted">Pricing…</p>}
        {state.status === 'error' && <p className="text-[14px] text-accent">{state.message}</p>}
        {state.status === 'ready' && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] tabular-nums">
                {state.quote.unitPrice} <span className="text-[12px] text-muted">per unit</span>
              </p>
              <p className="text-[19px] font-medium tabular-nums">{state.quote.lineTotal}</p>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              {state.quote.unitsAfterCommitment} units would count toward this group.
              {state.quote.unitSavingPaise > 0 && ` That is ${state.quote.unitSavingPaise / 100} rupees below the current ${state.quote.currentUnitPrice} per unit.`}
              {state.quote.unitsToNextTier !== null && ` ${state.quote.unitsToNextTier} more units unlock the next tier.`}
            </p>
          </>
        )}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Sample calculation only — no commitment is created, no stock is reserved and nothing is charged.
      </p>
    </div>
  )
}
