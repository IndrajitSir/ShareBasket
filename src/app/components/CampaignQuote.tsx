import { Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MAX_UNITS_PER_QUOTE } from '../../data/campaigns'

interface QuoteResponse {
  quote: {
    quantity: number
    unitPrice: string
    lineTotal: string
    currentUnitPrice: string
    unitsAfterCommitment: number
    unitsToNextTier: number | null
  }
  previewOnly: boolean
}

export function CampaignQuote({ slug }: { slug: string }) {
  const [quantity, setQuantity] = useState(1)
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data?: QuoteResponse; message?: string }>({ status: 'idle' })

  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })

    fetch(`/api/campaigns/${encodeURIComponent(slug)}/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json()
        if (!response.ok) {
          const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Unable to price this quantity.'
          throw new Error(message)
        }
        setState({ status: 'ready', data: body as QuoteResponse })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to price this quantity.' })
      })

    return () => controller.abort()
  }, [quantity, slug])

  const quote = state.data?.quote
  const step = (delta: number) => setQuantity((current) => Math.min(MAX_UNITS_PER_QUOTE, Math.max(1, current + delta)))

  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[24px]">Price my quantity</h2>
        <span className="text-[12px] text-muted">Preview quote</span>
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
        {quote && state.status === 'ready' && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] tabular-nums">{quote.unitPrice} <span className="text-[12px] text-muted">per unit</span></p>
              <p className="text-[19px] font-medium tabular-nums">{quote.lineTotal}</p>
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              {quote.unitsAfterCommitment} units would count toward this group.
              {quote.unitPrice !== quote.currentUnitPrice && ` That is below the current ${quote.currentUnitPrice} per unit.`}
              {quote.unitsToNextTier !== null && ` ${quote.unitsToNextTier} more units unlock the next tier.`}
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
