import { LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/auth-forms'
import { SettingsForm } from '@/components/settings-form'
import { ButtonLink, Container } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'General preferences for your ShareBasket experience, and signing out.',
}

const PROVIDER_LABELS = {
  local: 'Email & password',
  google: 'Google',
  github: 'GitHub',
} as const

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/settings')

  return (
    <Container className="max-w-4xl pb-20 pt-10 sm:pt-16">
      <p className="text-[14px] text-muted">Your account</p>
      <h1 className="font-display mt-3 text-balance text-[44px] leading-[1] sm:text-[64px]">
        Settings
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        Choose how ShareBasket behaves in this browser, and sign out when you are done.
      </p>

      <SettingsForm />

      <section aria-labelledby="session-heading" className="mt-6 rounded-[26px] border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <UserRound className="size-4 text-accent" aria-hidden />
          <h2 id="session-heading" className="font-display text-[24px] leading-none">
            Session
          </h2>
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-4 shrink-0 text-muted" aria-hidden />
            <div className="min-w-0">
              <dt className="text-[12.5px] text-muted">Signed in as</dt>
              <dd className="mt-0.5 truncate text-[14px]">{user.email}</dd>
            </div>
          </div>
          <div>
            <dt className="text-[12.5px] text-muted">Sign-in method</dt>
            <dd className="mt-1 text-[14px]">{PROVIDER_LABELS[user.provider]}</dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
            Logging out clears the session cookie in this browser. Copied session tokens remain valid
            until they expire because revocation is not implemented.
          </p>
          <LogoutButton />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-dashed border-line-strong px-5 py-6">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
          <p className="max-w-lg text-[12.5px] leading-relaxed text-muted">
            Looking for your profile, groups and verification status? That still lives on the account
            page.
          </p>
        </div>
        <ButtonLink href="/account" size="sm" variant="secondary">
          Go to account
        </ButtonLink>
      </div>
    </Container>
  )
}
