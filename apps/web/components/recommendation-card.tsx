import { ArrowRight, Clock3, MapPin, UsersRound } from 'lucide-react'
import Link from 'next/link'

import type { RecommendedCampaign } from '@/lib/recommendation-types'
import { formatClosingDate } from '@/lib/format'

/**
 * One explainable pick. Every card states why it was suggested, so the page
 * never presents a recommendation as a guarantee or an invented saving.
 */
export function RecommendationCard({
  item,
  index = 0,
}: {
  item: RecommendedCampaign
  index?: number
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <Link href={`/campaigns/${item.slug}`} className="image-frame relative block aspect-[16/10]">
        <img
          src={item.product.image}
          alt={item.product.name}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading={index < 3 ? 'eager' : 'lazy'}
        />
        <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-medium">
          {item.currentUnitPrice} <span className="font-normal text-muted">per unit</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[26px] leading-tight">
              <Link href={`/campaigns/${item.slug}`} className="hover:text-accent">
                {item.product.name}
              </Link>
            </h3>
            <p className="mt-1 text-[13px] text-muted">{item.product.category}</p>
          </div>
        </div>

        <p className="mt-3 inline-flex items-start gap-2 rounded-[12px] bg-surface-2/70 px-3 py-2 text-[12.5px] leading-snug text-muted">
          <UsersRound className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
          {item.reason}
        </p>

        <dl className="mt-4 flex flex-col gap-1.5 text-[12.5px] text-muted">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">Group</dt>
            <dd className="truncate">
              {item.society.name} · {item.society.location.split('·').at(-1)?.trim()}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock3 className="size-3.5 shrink-0" aria-hidden />
            <dt className="sr-only">Closes</dt>
            <dd>Closes {formatClosingDate(item.closesAt)}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-4">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="tabular-nums font-medium">{item.unitsCommitted} pledged</span>
            <span className="text-muted tabular-nums">{item.minimumUnits} min.</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-label={`${item.product.name} group progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.progressPercent}
          >
            <div
              className="h-full rounded-full bg-[#4d6c51]"
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
          <Link
            href={`/campaigns/${item.slug}`}
            className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium hover:text-accent"
          >
            View group buy <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}

export function RecommendationGrid({
  items,
  emptyMessage,
}: {
  items: RecommendedCampaign[]
  emptyMessage: string
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface px-5 py-8 text-[14px] text-muted">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item, index) => (
        <RecommendationCard key={item.slug} item={item} index={index} />
      ))}
    </div>
  )
}
