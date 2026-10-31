import { BadgeCheck, MapPin, ShoppingBasket } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth-forms'
import { ButtonLink, Container } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Your ShareBasket account, sign-in method and next steps.',
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

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/account')

  const params = await searchParams
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
        This is the identity every future society membership and commitment will attach to. Ordering, payments
        and society verification are not enabled yet.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="profile-heading" className="rounded-[26px] border border-line bg-surface p-6 sm:p-8">
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
              Logging out clears the cookie in this browser. Copied session tokens remain valid until they expire
              because revocation is not implemented.
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
                Society membership and address verification.
              </li>
              <li className="flex gap-3">
                <ShoppingBasket className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                Commitment rules and a real order flow.
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
            Accounts are a preview foundation. There is no email verification, password reset, MFA or login rate
            limiting yet, and no order can be placed.
          </p>
        </aside>
      </div>
    </Container>
  )
}
