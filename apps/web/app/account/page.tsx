import { ArrowRight, BadgeCheck, Hourglass, MapPin, ShieldCheck, ShoppingBasket, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth-forms'
import { ButtonLink, Container } from '@/components/ui'
import { VerificationStatusBadge } from '@/components/verification-status'
import { getCurrentUser } from '@/lib/auth'
import { formatClosingDate } from '@/lib/format'
import { fetchMyGroups } from '@/lib/groups'
import type { GroupSummary } from '@/lib/recommendation-types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your ShareBasket account, group memberships, sign-in method and next steps.',
}

const PROVIDER_LABELS = {
  local: 'Email & password',
  google: 'Google',
  github: 'GitHub',
} as const

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function MembershipBadge({ group }: { group: GroupSummary }) {
  if (group.status === 'PENDING') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent">
        <Hourglass className="size-3" aria-hidden /> Waiting for approval
      </span>
    )
  }

  if (group.role === 'STEWARD') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent">
        <ShieldCheck className="size-3" aria-hidden /> Steward
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] text-muted">
      Member
    </span>
  )
}

function GroupCard({ group }: { group: GroupSummary }) {
  const pending = group.status === 'PENDING'

  return (
    <li className="flex flex-col rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display truncate text-[24px] leading-tight">{group.name}</p>
          <p className="mt-1 truncate text-[12.5px] text-muted">{group.location}</p>
        </div>
        <MembershipBadge group={group} />
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        {pending ? (
          <span>
            Asked {group.requestedAt ? formatClosingDate(group.requestedAt, 'long') : 'recently'} · a
            steward still has to approve it
          </span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound className="size-3.5" aria-hidden />
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            </span>
            <span>
              {group.activeCampaigns} open {group.activeCampaigns === 1 ? 'group buy' : 'group buys'}
            </span>
          </>
        )}
      </p>

      {!pending && group.role === 'STEWARD' && group.pendingRequests > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent">
          {group.pendingRequests} {group.pendingRequests === 1 ? 'request' : 'requests'} waiting for
          you
        </p>
      )}

      {!pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerificationStatusBadge status={group.verificationStatus} />
          {(group.verificationStatus === 'UNVERIFIED' ||
            group.verificationStatus === 'REJECTED') && (
            <span className="text-[12px] text-faint">Add your address inside the group</span>
          )}
        </div>
      )}

      <Link
        href={`/groups/${group.id}`}
        className="mt-4 inline-flex items-center gap-1.5 self-start text-[13.5px] font-medium hover:text-accent"
      >
        {pending ? 'View request' : 'Open group'} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </li>
  )
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')

  const [params, groupsResult] = await Promise.all([searchParams, fetchMyGroups()])
  const joined = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
    new Date(user.createdAt),
  )

  return (
    <Container className="max-w-5xl pb-20 pt-10 sm:pt-16">
      {params.welcome === '1' && (
        <p
          role="status"
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#4d6c51]/25 bg-[#4d6c51]/10 px-4 py-2 text-[13px] text-[#3d5a41]"
        >
          <BadgeCheck className="size-4" aria-hidden />
          You are signed in.
        </p>
      )}

      <p className="text-[14px] text-muted">Your account</p>
      <h1 className="font-display mt-3 text-balance text-[44px] leading-[1] sm:text-[64px]">
        Hello, {user.name.split(/\s+/)[0]}.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        This is the identity your society memberships attach to. Each group is separate: joining one
        creates a request that a steward there reviews. Ordering and payments are not enabled yet.
      </p>

      <section aria-labelledby="groups-heading" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="groups-heading" className="font-display text-[30px] leading-none">
              Your groups
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
              Pending requests are listed here too, so you always know where a request stands.
            </p>
          </div>
          <ButtonLink href="/for-you" size="sm" variant="secondary">
            Find another group <ArrowRight />
          </ButtonLink>
        </div>

        {groupsResult.ok ? (
          groupsResult.groups.length > 0 ? (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {groupsResult.groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-[20px] border border-dashed border-line-strong px-5 py-8">
              <p className="font-display text-[26px] leading-tight">No groups yet</p>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">
                Join the society you live in to see what your neighbours are buying. A steward
                reviews each request before it becomes membership.
              </p>
              <ButtonLink href="/for-you" size="sm" className="mt-4">
                Find your group <ArrowRight />
              </ButtonLink>
            </div>
          )
        ) : (
          <p
            role="status"
            className="mt-4 rounded-[16px] border border-line bg-accent-soft px-4 py-3 text-[13px] text-accent"
          >
            {groupsResult.message}
          </p>
        )}
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section
          aria-labelledby="profile-heading"
          className="rounded-[26px] border border-line bg-surface p-6 sm:p-8"
        >
          <h2 id="profile-heading" className="font-display text-[30px] leading-none">
            Profile
          </h2>
          <div className="mt-7 flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-16 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="round grid size-16 place-items-center rounded-full bg-surface-2 font-display text-[24px]">
                {initials(user.name) || 'SB'}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[18px] font-medium">{user.name}</p>
              <p className="truncate text-[14px] text-muted">{user.email}</p>
            </div>
          </div>

          <dl className="mt-8 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-[12.5px] text-muted">Sign-in method</dt>
              <dd className="mt-1 text-[14px]">{PROVIDER_LABELS[user.provider]}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Account created</dt>
              <dd className="mt-1 text-[14px]">{joined}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Session</dt>
              <dd className="mt-1 text-[14px]">7-day HttpOnly cookie</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Email verified</dt>
              <dd className="mt-1 text-[14px]">Not yet</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
            <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
              Logging out clears the cookie in this browser. Copied session tokens remain valid until
              they expire because revocation is not implemented.
            </p>
            <LogoutButton />
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-[26px] border border-line bg-surface p-6 sm:p-8">
            <h2 className="font-display text-[28px] leading-none">What is next</h2>
            <ul className="mt-5 flex flex-col gap-4 text-[14px] leading-relaxed text-muted">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Disputes when two accounts claim the same unit, reviewed by another steward.
              </li>
              <li className="flex gap-3">
                <ShoppingBasket className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Commitment rules and a real order flow.
              </li>
              <li className="flex gap-3">
                <Hourglass className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Email notifications when a request is approved or declined.
              </li>
            </ul>
            <div className="mt-6 flex flex-col gap-2">
              <ButtonLink href="/campaigns" size="sm" className="w-full">
                Browse group buys
              </ButtonLink>
              <ButtonLink href="/shop" variant="secondary" size="sm" className="w-full">
                Shop the catalogue
              </ButtonLink>
            </div>
          </section>

          <p className="rounded-[20px] border border-line bg-surface-2/60 p-5 text-[12.5px] leading-relaxed text-muted">
            Accounts are a preview foundation. There is no email verification, password reset, MFA or
            login rate limiting yet, and no order can be placed.
          </p>
        </aside>
      </div>
    </Container>
  )
}
