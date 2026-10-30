'use client'

import { ArrowRight, ArrowUpRight, Clock3, Leaf, MapPin, PackageCheck, UsersRound } from 'lucide-react'
import { motion } from 'motion/react'
import Link from 'next/link'

import type { Campaign, Category, Product } from '@/lib/api'
import { ProductCard } from './product-card'
import { Reveal } from './reveal'
import { ButtonLink, Container, SectionTitle } from './ui'

const ease = [0.22, 1, 0.36, 1] as const

export function HomeView({
  campaigns,
  featured,
  arrivals,
  categories,
  unavailable,
}: {
  campaigns: Campaign[]
  featured: Product[]
  arrivals: Product[]
  categories: Category[]
  unavailable: boolean
}) {
  return (
    <>
      <section className="pt-10 sm:pt-16">
        <Container>
          <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="pb-4">
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="text-[14px] text-muted">
                Community buying · Sample preview
              </motion.p>
              <h1 className="font-display mt-4 text-[56px] leading-[0.98] sm:text-[80px] lg:text-[96px]">
                <span className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
                  <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease }}>
                    Better together,
                  </motion.span>
                </span>
                <span className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
                  <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.22, ease }}>
                    right <em className="italic text-accent">at home</em>
                  </motion.span>
                </span>
              </h1>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45, ease }} className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
                Neighbours pool everyday needs, unlock fairer volume prices, and share one convenient delivery. See what your community could buy together.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/campaigns" size="lg" className="w-full sm:w-auto">
                  Browse group buys
                  <ArrowRight />
                </ButtonLink>
                <ButtonLink href="/shop" size="lg" variant="secondary" className="w-full sm:w-auto">
                  Shop essentials
                </ButtonLink>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.2, ease }}
              className="image-frame relative aspect-[4/3] rounded-[32px] lg:aspect-[5/4]"
            >
              <img src="/images/rice.svg" alt="Illustration of a sample basmati rice group-buy sack" className="size-full object-cover" fetchPriority="high" />
              {campaigns[0]?.product && (
                <Link
                  href={`/campaigns/${campaigns[0].slug}`}
                  className="absolute bottom-4 left-4 flex items-center gap-3 rounded-[16px] bg-surface/90 py-2 pl-2 pr-4 text-[13px] shadow-soft backdrop-blur transition-colors hover:bg-surface"
                >
                  <span className="image-frame size-10 rounded-[12px]">
                    <img src={campaigns[0].product.image} alt="" className="size-full object-cover" />
                  </span>
                  <span>
                    <span className="block font-medium">{campaigns[0].product.name}</span>
                    <span className="text-muted">from {campaigns[0].currentUnitPrice} · group preview</span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              )}
            </motion.div>
          </div>
        </Container>
      </section>

      {unavailable && (
        <Container className="pt-10">
          <p className="rounded-card border border-line bg-accent-soft px-5 py-4 text-[14px] text-accent" role="status">
            The catalogue API is unavailable right now, so sample campaigns and products cannot load. Check that the API service is running and reachable at the configured `API_URL`.
          </p>
        </Container>
      )}

      <section className="pt-20 sm:pt-28">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Sample campaigns · Bengaluru"
              title="Your neighbours are buying"
              action={
                <Link href="/campaigns" className="hidden items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg sm:inline-flex">
                  All group buys <ArrowRight className="size-4" />
                </Link>
              }
            />
          </Reveal>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted">
            Preview how neighbours can unlock better volume tiers together. These examples are illustrative; there are no live suppliers, orders, or inventory.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {campaigns.map((campaign, index) => {
              if (!campaign.product) return null
              return (
                <Reveal key={campaign.slug} delay={index * 0.07}>
                  <Link href={`/campaigns/${campaign.slug}`} className="group block overflow-hidden rounded-card border border-line bg-surface transition-transform hover:-translate-y-0.5">
                    <div className="image-frame relative aspect-[4/3]">
                      <img src={campaign.product.image} alt={campaign.product.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" />
                      <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-3 py-1.5 text-[12px]">Sample campaign</span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-[26px] leading-tight">{campaign.product.name}</h3>
                          <p className="mt-1 text-[12px] text-muted">{campaign.society}</p>
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-[11px] text-muted">Now</span>
                          <span className="block font-medium tabular-nums">{campaign.currentUnitPrice}</span>
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1.5"><UsersRound className="size-3.5" />{campaign.unitsCommitted} joined</span>
                        <span>{campaign.progress.minimumMet ? 'Minimum met' : `${campaign.progress.unitsRemaining} to minimum`}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={`${campaign.product.name} group order progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={campaign.progress.percent}>
                        <div className="h-full rounded-full bg-[#4d6c51]" style={{ width: `${campaign.progress.percent}%` }} />
                      </div>
                      <p className="mt-3 flex items-center justify-between text-[12px] text-muted">
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{campaign.location}</span>
                        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </p>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />See closing dates up front</span>
            <span className="inline-flex items-center gap-1.5"><PackageCheck className="size-3.5" />Shared delivery windows</span>
          </div>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/campaigns" variant="secondary">Explore all group buys <ArrowRight /></ButtonLink>
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Just in"
              title="New arrivals"
              action={
                <Link href="/shop" className="hidden items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg sm:inline-flex">
                  View all <ArrowRight className="size-4" />
                </Link>
              }
            />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {arrivals.map((product, index) => (
              <ProductCard key={product.slug} product={product} index={index} priority={index < 2} />
            ))}
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
            {categories.slice(0, 3).map((category, index) => (
              <Reveal key={category.key} delay={index * 0.08}>
                <Link href={`/shop?category=${category.key}`} className="group image-frame relative block aspect-[4/5] rounded-image">
                  <img src={category.image} alt={category.label} className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between rounded-[18px] bg-surface/90 p-4 backdrop-blur">
                    <div>
                      <p className="font-display text-[28px] leading-none">{category.label}</p>
                      <p className="mt-1.5 text-[13px] text-muted">{category.blurb}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-[12px] bg-fg text-bg transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid items-center gap-10 rounded-[32px] bg-surface-2/60 p-5 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <Reveal className="image-frame aspect-[4/3] rounded-image">
              <img src="/images/lookbook.jpg" alt="A sunlit corner with a linen throw and brass lamp" className="size-full object-cover" loading="lazy" />
            </Reveal>
            <Reveal delay={0.1} className="lg:pr-8">
              <p className="text-[14px] text-muted">The project</p>
              <h2 className="font-display mt-3 text-balance text-[40px] leading-[1.02] sm:text-[52px]">Built for neighbours, priced by the group</h2>
              <p className="mt-5 text-pretty text-[16px] leading-relaxed text-muted">
                ShareBasket aggregates demand inside a residential society, shows every quantity tier before anyone commits, and coordinates one shared delivery. This preview uses synthetic catalogue and campaign data.
              </p>
              <ButtonLink href="/about" variant="secondary" className="mt-8">
                Read the project notes
              </ButtonLink>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle eyebrow="From the API" title="Bestsellers" />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-6">
            {featured.map((product, index) => (
              <ProductCard key={product.slug} product={product} index={index} />
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ButtonLink href="/shop" variant="secondary" size="lg">
              Shop everything
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <ul className="grid gap-4 border-y border-line py-10 sm:grid-cols-3">
            {[
              { icon: UsersRound, title: 'Buy together', body: 'Group orders bring neighbours into one delivery.' },
              { icon: PackageCheck, title: 'Clear delivery dates', body: 'Every sample campaign shows its expected delivery.' },
              { icon: Leaf, title: 'Transparent tiers', body: 'See what each group size means for unit price.' },
            ].map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 0.08}>
                <li className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-fg">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[14px] text-muted">{body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
          <p className="py-6 text-center text-[12px] text-faint">
            Campaign closes are shown in your local time zone. Sample data only — no live orders or payments.
          </p>
        </Container>
      </section>
    </>
  )
}
