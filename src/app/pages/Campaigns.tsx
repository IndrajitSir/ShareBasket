import { ArrowDownUp, ArrowRight, Clock3, MapPin, PackageCheck, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { campaigns, formatRupees, getCampaignProduct, getCampaignProgress, getUnitPricePaise } from '../../data/campaigns'
import type { Category } from '../../data/products'
import { Container, SectionTitle } from '../components/ui'
import { cx } from '../lib/cx'

const categories: { label: string; value: Category | 'all' }[] = [
  { label: 'Everything', value: 'all' },
  { label: 'Pantry', value: 'pantry' },
  { label: 'Ceramics', value: 'ceramics' },
  { label: 'Textiles', value: 'textiles' },
  { label: 'Home', value: 'home' },
]

function closeLabel(closesAt: string): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(closesAt))
}

export function Campaigns() {
  const [params, setParams] = useSearchParams()
  const [sortBy, setSortBy] = useState<'closing' | 'progress'>('closing')
  const requestedSociety = params.get('society') ?? ''
  const selectedSociety = campaigns.some((campaign) => campaign.society === requestedSociety) ? requestedSociety : ''
  const requestedCategory = params.get('category') ?? 'all'
  const selectedCategory = categories.some((category) => category.value === requestedCategory) ? requestedCategory : 'all'

  const options = useMemo(() => {
    const uniqueSocieties = [...new Set(campaigns.map((campaign) => campaign.society))]
    return uniqueSocieties
  }, [])

  const shownCampaigns = useMemo(() => {
    const matching = campaigns.filter((campaign) => {
      const product = getCampaignProduct(campaign)
      return product && (!selectedSociety || campaign.society === selectedSociety) && (selectedCategory === 'all' || product.category === selectedCategory)
    })
    return [...matching].sort((left, right) => {
      if (sortBy === 'progress') {
        const a = getCampaignProgress(left).percent
        const b = getCampaignProgress(right).percent
        return b - a
      }
      return new Date(left.closesAt).getTime() - new Date(right.closesAt).getTime()
    })
  }, [selectedCategory, selectedSociety, sortBy])

  const scoped = Boolean(selectedSociety)

  return (
    <>
      <section className="border-b border-line bg-surface/60">
        <Container className="py-10 sm:py-16">
          <p className="text-[14px] font-medium text-accent">Community buying · Preview campaigns</p>
          <h1 className="font-display mt-3 max-w-4xl text-balance text-[48px] leading-[0.97] sm:text-[76px]">
            Good things happen when we buy together.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[18px]">
            Find a group order near you, see each price threshold up front, and help your neighbours unlock the next one. Sample campaigns only — no orders or inventory are live.
          </p>
          <div className="mt-7 flex flex-wrap gap-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-bg px-3 py-1.5"><UsersRound className="size-3.5" /> 3 sample communities</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-bg px-3 py-1.5"><PackageCheck className="size-3.5" /> Shared delivery dates</span>
          </div>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <SectionTitle eyebrow="Open group orders" title={scoped ? selectedSociety : 'Shop the community'} />
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <MapPin className="size-4" />
            <span className="sr-only">Filter by community</span>
            <select
              aria-label="Filter by community"
              value={selectedSociety}
              onChange={(event) => {
                const next = new URLSearchParams(params)
                event.target.value ? next.set('society', event.target.value) : next.delete('society')
                setParams(next, { replace: true })
              }}
              className="h-11 min-w-52 rounded-control border border-line-strong bg-transparent px-3 text-[14px] text-fg focus:border-fg focus:outline-none"
            >
              <option value="">All communities</option>
              {options.map((society) => <option key={society} value={society}>{society}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter campaigns by category">
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                aria-pressed={selectedCategory === category.value}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  category.value === 'all' ? next.delete('category') : next.set('category', category.value)
                  setParams(next, { replace: true })
                }}
                className={cx('rounded-full px-4 py-2 text-[13px] transition-colors', selectedCategory === category.value ? 'bg-fg text-bg' : 'border border-line-strong text-muted hover:text-fg')}
              >
                {category.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSortBy(sortBy === 'closing' ? 'progress' : 'closing')} className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
            <ArrowDownUp className="size-4" /> Sort: {sortBy === 'closing' ? 'Closing soon' : 'Most progress'}
          </button>
        </div>

        <p className="mt-5 text-[13px] text-muted" aria-live="polite">{shownCampaigns.length} group {shownCampaigns.length === 1 ? 'order' : 'orders'} {selectedSociety ? `in ${selectedSociety}` : 'across Bengaluru'} · Sample preview</p>

        {shownCampaigns.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {shownCampaigns.map((campaign) => {
              const product = getCampaignProduct(campaign)!
              const progress = getCampaignProgress(campaign)
              const unitPrice = getUnitPricePaise(campaign, campaign.unitsCommitted)
              const starterPrice = getUnitPricePaise(campaign, 1)
              const nextTierPrice = progress.nextTier ? formatRupees(progress.nextTier.unitPricePaise) : null

              return (
                <article key={campaign.slug} className="overflow-hidden rounded-card border border-line bg-surface">
                  <Link to={`/campaigns/${campaign.slug}`} className="group image-frame relative block aspect-[4/3]">
                    <img src={product.image} alt={product.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
                    <span className="absolute left-4 top-4 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-medium text-fg">{product.category === 'pantry' ? 'Pantry staple' : product.category}</span>
                    <span className="absolute right-4 top-4 rounded-full bg-fg/90 px-3 py-1.5 text-[12px] font-medium text-bg">{progress.minimumMet ? 'Minimum met' : 'Open to join'}</span>
                  </Link>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-display text-[28px] leading-tight">{product.name}</h2>
                        <p className="mt-1 text-[13px] text-muted">{product.short}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted">Today from</p>
                        <p className="mt-1 text-[19px] font-medium tabular-nums">{formatRupees(unitPrice)}</p>
                        {unitPrice < starterPrice && <p className="text-[12px] text-muted">per unit at current total</p>}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px] text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{campaign.society} · {campaign.location.split('·').at(-1)?.trim()}</span></span>
                      <span className="inline-flex shrink-0 items-center gap-1.5"><Clock3 className="size-3.5" /> Closes {closeLabel(campaign.closesAt)}</span>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
                        <span className="font-medium tabular-nums">{campaign.unitsCommitted} neighbours joined</span>
                        <span className="text-muted tabular-nums">{campaign.minimumUnits} min.</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${product.name} group order progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                        <div className="h-full rounded-full bg-[#4d6c51] transition-[width]" style={{ width: `${progress.percent}%` }} />
                      </div>
                      <p className="mt-2 min-h-5 text-[12.5px] text-muted" aria-live="polite">
                        {progress.minimumMet ? 'Minimum order reached — group price is locked.' : `${progress.unitsRemaining} more to reach the minimum.`}
                        {nextTierPrice && ` ${progress.nextTier!.minimumUnits - campaign.unitsCommitted} more unlock ${nextTierPrice} per unit.`}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-[12.5px] text-muted">Delivery {campaign.deliveryDate} · sample schedule</span>
                      <Link to={`/campaigns/${campaign.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:text-accent">View details <ArrowRight className="size-4" /></Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-card border border-line bg-surface px-6 py-14 text-center">
            <h2 className="font-display text-[32px]">No sample group orders match those filters</h2>
            <p className="mt-2 text-[14px] text-muted">Try a different community or category.</p>
            <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })} className="mt-5 rounded-control bg-fg px-5 py-3 text-[14px] text-bg">Clear filters</button>
          </div>
        )}
      </Container>
    </>
  )
}
