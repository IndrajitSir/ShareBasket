import { ArrowRight, Hourglass, Info, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { NearbyExplorer } from '@/components/nearby-explorer'
import { RecommendationGrid } from '@/components/recommendation-card'
import { ButtonLink, Container, SectionTitle } from '@/components/ui'
import { fetchRecommendations } from '@/lib/recommendations'
import type { Recommendations } from '@/lib/recommendation-types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For you',
  description:
    'Neighbour-backed group-buy suggestions: what your group is buying, what other groups are buying, and groups near you.',
}

export default async function ForYouPage() {
  let data: Recommendations | null = null
  try {
    data = await fetchRecommendations()
  } catch {
    data = null
  }

  if (!data) {
    return (
      <Container className="py-20">
        <p className="text-[14px] text-muted">For you</p>
        <h1 className="font-display mt-2 text-[44px]">Suggestions are unavailable</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          The recommendations API could not be reached. Everything else in the catalogue still works.
        </p>
        <ButtonLink href="/campaigns" className="mt-6">
          Browse group buys <ArrowRight />
        </ButtonLink>
      </Container>
    )
  }

  return (
    <Container className="pb-24 pt-10 sm:pt-16">
      <p className="inline-flex items-center gap-2 text-[13px] text-muted">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        For you · {data.model.name} {data.model.version}
      </p>
      <h1 className="font-display mt-3 max-w-3xl text-balance text-[44px] leading-[0.98] sm:text-[64px]">
        {data.signedIn ? 'Picked around your neighbours' : 'What communities are buying'}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        Suggestions combine what your group has pledged, what neighbours and other groups have quoted,
        how close each campaign is to its minimum, and how soon it closes. Nothing here is a purchase
        history or a promise of savings.
      </p>

      {!data.signedIn && (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[22px] border border-line bg-surface px-5 py-4">
          <p className="text-[14px] text-muted">
            Sign in to see picks from your own group and to find groups near you.
          </p>
          <div className="flex gap-2">
            <ButtonLink href="/login?next=/for-you" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm" variant="secondary">
              Create account
            </ButtonLink>
          </div>
        </div>
      )}

      {data.signedIn && data.groups.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <UsersRound className="size-3.5" aria-hidden /> Your groups:
          </span>
          {data.groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-bg px-3 py-1.5 text-fg transition-colors hover:border-fg"
            >
              {group.name}
              {group.status === 'PENDING' ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-accent">
                  <Hourglass className="size-3" aria-hidden /> Pending
                </span>
              ) : (
                <>
                  <span className="text-muted">{group.memberCount}</span>
                  {group.role === 'STEWARD' && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-accent">
                      <ShieldCheck className="size-3" aria-hidden /> Steward
                      {group.pendingRequests > 0 && (
                        <span className="rounded-full bg-accent-soft px-1.5 tabular-nums">
                          {group.pendingRequests}
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </div>
      )}

      {data.personalized && (
        <section className="pt-14" aria-labelledby="in-your-groups">
          <SectionTitle
            eyebrow="From your own group"
            title="What your neighbours are buying"
            className="[&_h2]:text-[34px] sm:[&_h2]:text-[42px]"
          />
          <div className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Campaigns in your societies, ranked by quote interest from other members, group demand and
            closing time. Your own quotes are left out so these stay new.
          </div>
          <div className="mt-7">
            <RecommendationGrid
              items={data.sections.inYourGroups}
              emptyMessage="Nothing is open in your groups right now. Start a group buy from the shop."
            />
          </div>
        </section>
      )}

      {data.signedIn && (
        <section className="pt-16" aria-labelledby="other-groups">
          <SectionTitle
            eyebrow="Across the city"
            title="What other groups are buying"
            className="[&_h2]:text-[34px] sm:[&_h2]:text-[42px]"
          />
          <div className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Group buys running in other communities, including campaigns your neighbours have quoted
            even where they cannot join yet.
          </div>
          <div className="mt-7">
            <RecommendationGrid
              items={data.sections.otherGroups}
              emptyMessage="No other group campaigns are open right now."
            />
          </div>
        </section>
      )}

      {data.signedIn && data.needsGroup && (
        <section className="pt-14">
          <div className="rounded-[26px] border border-line bg-surface-2/60 p-6 sm:p-8">
            <p className="text-[12.5px] text-accent">No group yet</p>
            <h2 className="font-display mt-2 max-w-2xl text-balance text-[32px] leading-[1.05] sm:text-[40px]">
              Your group picks start with a group
            </h2>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
              Join the society you live in and this page becomes what your neighbours are buying. If you
              are not sure which groups exist, share your location and we will show the closest ones.
            </p>
          </div>
        </section>
      )}

      <section className="pt-10">
        <NearbyExplorer signedIn={data.signedIn} />
      </section>

      <section className="pt-16" aria-labelledby="trending">
        <SectionTitle
          eyebrow="Cold start"
          title="Trending this week"
          className="[&_h2]:text-[34px] sm:[&_h2]:text-[42px]"
        />
        <div className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Ranked by how close each open campaign is to its minimum quantity. This is what everyone sees
          before there is enough group or quote signal to personalize.
        </div>
        <div className="mt-7">
          <RecommendationGrid
            items={data.sections.trending}
            emptyMessage="No campaigns are open right now."
          />
        </div>
      </section>

      <aside className="mt-16 flex flex-col gap-3 rounded-[22px] border border-line bg-surface-2/50 p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6">
        <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
        <div className="text-[12.5px] leading-relaxed text-muted">
          <p className="font-medium text-fg">How this works, honestly</p>
          <p className="mt-1.5">
            This is an explainable hybrid recommender, not a trained purchase model: there are no orders
            yet. Signals are campaign quantities pledged and quotes from signed-in members. Each card
            says why it appeared. Location is optional, requested only after you press the button, and
            used in memory to sort groups by distance.
          </p>
          <p className="mt-1.5">
            Joining a group that already has members creates a request that a steward of that group
            approves or declines; the first member of an empty group becomes its steward. Every
            decision and role change is written to an append-only audit trail. There is still no
            address or tenancy check, and no email addresses are shown on a roster.{' '}
            <Link href="/about" className="underline underline-offset-2 hover:text-fg">
              Project notes
            </Link>
          </p>
        </div>
      </aside>
    </Container>
  )
}
