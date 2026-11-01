import { ArrowDownUp, ArrowRight, Clock3, MapPin, PackageCheck, Search, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Container, SectionTitle } from '@/components/ui'
import { fetchCampaigns, type Campaign } from '@/lib/api'
import { cx } from '@/lib/cx'
import { formatClosingDate, formatDeliveryDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ShareBasket',
  description: 'Sample community group-buying campaigns with transparent quantity tiers.',
}

const categories = [
  { value: '', label: 'Everything' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'ceramics', label: 'Ceramics' },
  { value: 'textiles', label: 'Textiles' },
  { value: 'home', label: 'Home' },
]

type SearchParams = Promise<{ category?: string; q?: string; society?: string; sort?: string }>

function hrefWith(
  current: { category?: string; q?: string; society?: string; sort?: string },
  changes: Record<string, string | undefined>,
) {
  const params = new URLSearchParams()
  const merged = { ...current, ...changes }
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `/campaigns?${query}` : '/campaigns'
}

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const category = categories.some((item) => item.value && item.value === params.category) ? params.category! : ''
  const sort = params.sort === 'progress' ? 'progress' : 'closing'
  const society = params.society?.slice(0, 120) ?? ''
  const q = params.q?.trim().slice(0, 80) ?? ''

  let campaigns: Campaign[] = []
  let societies: string[] = []
  let unavailable = false

  try {
    const [filtered, all] = await Promise.all([
      fetchCampaigns({ category: category || undefined, q: q || undefined, society: society || undefined, sort }),
      fetchCampaigns(),
    ])
    campaigns = filtered
    societies = [...new Set(all.map((item) => item.society))]
  } catch {
    unavailable = true
  }

  const current = {
    category: category || undefined,
    q: q || undefined,
    society: society || undefined,
    sort: sort === 'progress' ? 'progress' : undefined,
  }

  return (
    <>
      <section className="border-b border-line bg-surface/60">
        <Container className="py-10 sm:py-16">
          <p className="text-[14px] font-medium text-accent">Community buying · Preview campaigns</p>
          <h1 className="font-display mt-3 max-w-4xl text-balance text-[48px] leading-[0.97] sm:text-[76px]">Good things happen when we buy together.</h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[18px]">
            Find a group order near you, see each price threshold up front, and help your neighbours unlock the next one. Sample campaigns only — no orders or inventory are live.
          </p>
          <div className="mt-7 flex flex-wrap gap-2 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-bg px-3 py-1.5"><UsersRound className="size-3.5" /> {societies.length || 3} sample communities</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-bg px-3 py-1.5"><PackageCheck className="size-3.5" /> Shared delivery dates</span>
          </div>
        </Container>
      </section>

      <Container className="py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <SectionTitle eyebrow="Open group orders" title={q ? `Results for “${q}”` : society || 'Shop the community'} />
          <div className="flex flex-wrap items-center gap-2" aria-label="Filter by community">
            <MapPin className="size-4 text-muted" aria-hidden />
            <Link href={hrefWith(current, { society: undefined })} className={cx('rounded-full px-3 py-1.5 text-[13px] transition-colors', !society ? 'bg-fg text-bg' : 'border border-line-strong text-muted hover:text-fg')}>
              All communities
            </Link>
            {societies.map((name) => (
              <Link key={name} href={hrefWith(current, { society: name })} aria-current={society === name ? 'true' : undefined} className={cx('rounded-full px-3 py-1.5 text-[13px] transition-colors', society === name ? 'bg-fg text-bg' : 'border border-line-strong text-muted hover:text-fg')}>
                {name}
              </Link>
            ))}
          </div>
        </div>

        <form action="/campaigns" role="search" className="mt-7 flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
          {category && <input type="hidden" name="category" value={category} />}
          {society && <input type="hidden" name="society" value={society} />}
          {sort === 'progress' && <input type="hidden" name="sort" value="progress" />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Search group buys"
              placeholder="Search products or communities…"
              className="h-12 w-full min-w-0 rounded-control border border-line-strong bg-surface pl-11 pr-4 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-fg focus:outline-none"
            />
          </div>
          <button type="submit" className="inline-flex h-12 shrink-0 items-center justify-center rounded-control bg-fg px-6 text-[14px] font-medium text-bg transition-colors hover:bg-[#33302b]">
            Search
          </button>
        </form>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter campaigns by category">
            {categories.map((item) => (
              <Link key={item.value || 'all'} href={hrefWith(current, { category: item.value || undefined })} aria-current={category === item.value ? 'true' : undefined} className={cx('rounded-full px-4 py-2 text-[13px] transition-colors', category === item.value ? 'bg-fg text-bg' : 'border border-line-strong text-muted hover:text-fg')}>
                {item.label}
              </Link>
            ))}
          </div>
          <Link href={hrefWith(current, { sort: sort === 'closing' ? 'progress' : undefined })} className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
            <ArrowDownUp className="size-4" /> Sort: {sort === 'closing' ? 'Closing soon' : 'Most progress'}
          </Link>
        </div>

        {unavailable ? (
          <p className="mt-8 rounded-card border border-line bg-accent-soft px-5 py-4 text-[14px] text-accent" role="status">
            Campaigns could not be loaded from the API. Check that the API service is running.
          </p>
        ) : (
          <p className="mt-5 text-[13px] text-muted" aria-live="polite">
            {campaigns.length} group {campaigns.length === 1 ? 'order' : 'orders'}{' '}
            {q ? `matching “${q}”` : society ? `in ${society}` : 'across Bengaluru'} · Sample preview
          </p>
        )}

        {!unavailable && campaigns.length > 0 && (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              if (!campaign.product) return null
              const nextTierPrice = campaign.progress.nextTier ? `₹${(campaign.progress.nextTier.unitPricePaise / 100).toFixed(2)}` : null
              return (
                <article key={campaign.slug} className="overflow-hidden rounded-card border border-line bg-surface">
                  <Link href={`/campaigns/${campaign.slug}`} className="group image-frame relative block aspect-[4/3]">
                    <img src={campaign.product.image} alt={campaign.product.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
                    <span className="absolute left-4 top-4 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-medium text-fg">{campaign.product.category ?? 'Sample'}</span>
                    <span className="absolute right-4 top-4 rounded-full bg-fg/90 px-3 py-1.5 text-[12px] font-medium text-bg">{campaign.isClosed ? 'Closed' : campaign.progress.minimumMet ? 'Minimum met' : 'Open to join'}</span>
                  </Link>
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-display text-[28px] leading-tight">{campaign.product.name}</h2>
                        <p className="mt-1 text-[13px] text-muted">{campaign.product.short}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted">Today from</p>
                        <p className="mt-1 text-[19px] font-medium tabular-nums">{campaign.currentUnitPrice}</p>
                        {campaign.progress.minimumMet && <p className="text-[12px] text-muted">per unit at current total</p>}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 text-[12.5px] text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{campaign.society} · {campaign.location.split('·').at(-1)?.trim()}</span></span>
                      <span className="inline-flex shrink-0 items-center gap-1.5"><Clock3 className="size-3.5" /> Closes {formatClosingDate(campaign.closesAt)}</span>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
                        <span className="font-medium tabular-nums">{campaign.unitsCommitted} neighbours joined</span>
                        <span className="text-muted tabular-nums">{campaign.minimumUnits} min.</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${campaign.product.name} group order progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={campaign.progress.percent}>
                        <div className="h-full rounded-full bg-[#4d6c51]" style={{ width: `${campaign.progress.percent}%` }} />
                      </div>
                      <p className="mt-2 min-h-5 text-[12.5px] text-muted">
                        {campaign.progress.minimumMet ? 'Minimum order reached — group price is locked.' : `${campaign.progress.unitsRemaining} more to reach the minimum.`}
                        {nextTierPrice && campaign.progress.nextTier && ` ${campaign.progress.nextTier.minimumUnits - campaign.unitsCommitted} more unlock ${nextTierPrice} per unit.`}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                      <span className="text-[12.5px] text-muted">Delivery {formatDeliveryDate(campaign.deliveryDate)} · sample schedule</span>
                      <Link href={`/campaigns/${campaign.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:text-accent">View details <ArrowRight className="size-4" /></Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {!unavailable && campaigns.length === 0 && (
          <div className="mt-10 rounded-card border border-line bg-surface px-6 py-14 text-center">
            <h2 className="font-display text-[32px]">
              {q ? `No group orders match “${q}”` : 'No sample group orders match those filters'}
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              {q ? 'Try a shorter search or a different community.' : 'Try a different community or category.'}
            </p>
            <Link
              href={q ? hrefWith(current, { q: undefined }) : '/campaigns'}
              className="mt-5 inline-flex rounded-control bg-fg px-5 py-3 text-[14px] text-bg"
            >
              {q ? 'Clear search' : 'Clear filters'}
            </Link>
          </div>
        )}
      </Container>
    </>
  )
}
