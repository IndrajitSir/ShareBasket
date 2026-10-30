import { ArrowLeft, Clock3, MapPin, PackageCheck, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CampaignQuotePanel } from '@/components/campaign-quote'
import { ButtonLink, Container } from '@/components/ui'
import { fetchCampaign } from '@/lib/api'
import { formatClosingDate, formatDeliveryDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const campaign = await fetchCampaign(slug).catch(() => null)
  return {
    title: campaign?.product?.name ?? 'Campaign',
    description: campaign?.product?.description ?? 'Sample community group-buy campaign.',
  }
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const campaign = await fetchCampaign(slug).catch(() => null)
  if (!campaign || !campaign.product) notFound()

  const progress = campaign.progress

  return (
    <Container className="pt-6 sm:pt-10">
      <Link href="/campaigns" className="inline-flex h-10 items-center gap-2 text-[14px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> All group buys
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div className="image-frame relative aspect-[4/3] overflow-hidden rounded-image lg:aspect-[0.94]">
          <img src={campaign.product.image} alt={campaign.product.name} className="size-full object-cover" />
          <span className="absolute left-4 top-4 rounded-full bg-surface/95 px-3 py-1.5 text-[12px] font-medium">Sample campaign</span>
        </div>
        <div className="lg:py-4">
          <p className="sr-only">Sample group-buy campaign. No orders, inventory or payments are live.</p>
          <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-accent">Community group order</p>
          <h1 className="font-display mt-3 text-[46px] leading-[0.98] sm:text-[64px]">{campaign.product.name}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{campaign.product.description}</p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-control border border-line bg-surface px-4 py-3">
              <p className="text-muted">Current group price</p>
              <p className="mt-1 text-[21px] font-medium tabular-nums">
                {campaign.currentUnitPrice} <span className="text-[12px] font-normal text-muted">/ unit</span>
              </p>
            </div>
            <div className="rounded-control border border-line bg-surface px-4 py-3">
              <p className="text-muted">Delivery estimate</p>
              <p className="mt-2 text-[17px] font-medium">{formatDeliveryDate(campaign.deliveryDate)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[27px]">The more we join, the lower it goes</h2>
              <span className="text-[12px] text-muted">Sample tiers</span>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {campaign.tiers.map((tier) => {
                const active = tier.unitPricePaise === campaign.currentUnitPricePaise
                return (
                  <li key={tier.minimumUnits} className="flex items-center justify-between gap-4 py-3 text-[14px]">
                    <span>{tier.minimumUnits === 1 ? 'Starting price' : `${tier.minimumUnits}+ neighbours`}</span>
                    <span className="font-medium tabular-nums">
                      ₹{(tier.unitPricePaise / 100).toFixed(2)}
                      <span className="ml-1 font-normal text-muted">per unit</span>
                      {active && <span className="ml-2 rounded-full bg-[#e5eee2] px-2 py-1 text-[11px] text-[#38543c]">Current</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              The preview shows sample tier prices to explain group buying. Final price, tax, fees and order rules require verified supplier data.
            </p>
          </div>

          <div className="mt-6 rounded-card border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium">{campaign.society}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted"><MapPin className="size-3.5" />{campaign.location}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><Clock3 className="size-3.5" />Closes {formatClosingDate(campaign.closesAt, 'long')}</span>
            </div>
            <div className="mt-5 flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-2"><UsersRound className="size-4" />{campaign.unitsCommitted} units committed</span>
              <span className="text-muted">{campaign.minimumUnits} minimum</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Group order minimum progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
              <div className="h-full rounded-full bg-[#4d6c51]" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              {progress.minimumMet ? 'The sample minimum has been reached.' : `${progress.unitsRemaining} more units needed to reach the sample minimum.`}
            </p>
          </div>

          {campaign.isClosed ? (
            <p className="mt-6 rounded-card border border-line bg-surface px-5 py-4 text-[14px] text-muted">
              This campaign is closed, so quotes are unavailable. Browse the other sample campaigns to see open tiers.
            </p>
          ) : (
            <CampaignQuotePanel slug={campaign.slug} />
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="inline-flex h-12 items-center justify-center gap-2 rounded-control border border-line-strong px-5 text-[14px] text-muted">
              <PackageCheck className="size-4" /> Preview only
            </span>
            <ButtonLink href="/campaigns" variant="secondary" className="h-12">Browse other group buys</ButtonLink>
          </div>
          <p className="mt-3 text-[12px] text-muted">This preview does not accept commitments, reserve stock or take payment.</p>
          <p className="mt-4">
            <Link href={`/shop?category=${campaign.product.category ?? ''}`} className="text-[13px] text-muted underline underline-offset-4 hover:text-fg">
              Browse similar products in the sample catalogue
            </Link>
          </p>
        </div>
      </div>
    </Container>
  )
}
