import type { Metadata } from 'next'

import { Reveal } from '@/components/reveal'
import { ButtonLink, Container } from '@/components/ui'

export const metadata: Metadata = {
  title: 'About the project',
  description: 'How the ShareBasket preview works, what is implemented, and what is not live yet.',
}

export default function AboutPage() {
  return (
    <Container className="pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-[14px] text-muted">About</p>
        <h1 className="font-display mt-3 text-balance text-[48px] leading-[1] sm:text-[72px]">
          Pooled demand, transparent tiers, one shared delivery
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted">
          ShareBasket is a community bulk-buying marketplace for residential societies. Neighbours commit to a campaign, the group unlocks lower unit prices at volume thresholds, and a single delivery serves the whole building. This deployment is a working preview with synthetic data.
        </p>
      </div>

      <Reveal className="image-frame mt-12 aspect-[16/9] rounded-[32px]">
        <img src="/images/lookbook.jpg" alt="A sunlit corner of a home with a linen throw and brass lamp" className="size-full object-cover" />
      </Reveal>

      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <p className="font-display text-[32px] leading-[1.1]">What the preview actually does</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-5 text-[16px] leading-relaxed text-muted">
          <p>
            A NestJS API stores categories, products, societies, campaigns and price tiers in a relational schema, and serves them under <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[13px]">/api/v1</code>. A Next.js storefront renders campaign discovery, campaign detail, the catalogue and product pages from those endpoints.
          </p>
          <p>
            Quantity quotes are calculated by the API, not the browser. The whole line is priced at the tier the requested units would reach, including units already committed, so the displayed unit price and total always agree with the server rules.
          </p>
          <p>
            Everything you see is sample data. There are no accounts, no membership approvals, no supplier onboarding and no live inventory. The bag is stored in your browser, and checkout explicitly creates no order and takes no payment.
          </p>
          <ButtonLink href="/campaigns" className="mt-2 self-start">See the sample campaigns</ButtonLink>
        </Reveal>
      </div>

      <dl className="mt-20 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          ['Campaigns seeded', '6'],
          ['Catalogue products', '17'],
          ['Order paths enabled', '0'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd className="font-display mt-2 text-[48px] leading-none">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-16 max-w-3xl border-t border-line pt-10">
        <h2 className="font-display text-[32px]">Architecture</h2>
        <ul className="mt-5 flex flex-col gap-3 text-[15px] leading-relaxed text-muted">
          <li><strong className="text-fg">Frontend:</strong> Next.js App Router and TypeScript in <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[13px]">apps/web</code>, deployable to Vercel.</li>
          <li><strong className="text-fg">Backend:</strong> NestJS with TypeORM in <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[13px]">apps/api</code>, deployable to Render or any container host.</li>
          <li><strong className="text-fg">Database:</strong> PostgreSQL in deployment, SQLite for local development and tests.</li>
          <li><strong className="text-fg">Money:</strong> integer paise end to end; formatting happens only at the presentation boundary.</li>
        </ul>
      </section>
    </Container>
  )
}
