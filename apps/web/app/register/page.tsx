import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { RegisterForm } from '@/components/auth-forms'
import { Container } from '@/components/ui'
import { getAuthProviders, getCurrentUser, safeNextPath } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a ShareBasket account with email or a connected Google/GitHub account.',
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  if (await getCurrentUser()) redirect('/account')

  const providers = await getAuthProviders()
  const next = safeNextPath(params.next)

  return (
    <Container className="grid gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_460px] lg:items-start lg:gap-20 lg:pt-24">
      <div className="max-w-xl">
        <p className="text-[13px] uppercase tracking-[0.18em] text-accent">Join in</p>
        <h1 className="font-display mt-4 text-balance text-[46px] leading-[0.98] sm:text-[64px]">
          Your neighbours are already pooling demand.
        </h1>
        <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-muted sm:text-[17px]">
          An account is the first step toward joining a society, following campaigns and, when ordering opens,
          committing to a group buy. Today it gives you a persistent session across the storefront.
        </p>

        <ul className="mt-10 flex flex-col gap-4 border-t border-line pt-8 text-[14px] leading-relaxed text-muted">
          <li>Browse every campaign tier without signing in; sign in to keep your account ready for membership.</li>
          <li>Password sign-up works immediately. Google and GitHub appear when the server has OAuth keys configured.</li>
          <li>No email is sent and no payment method is collected in this preview.</li>
        </ul>

        <p className="mt-8 max-w-md text-[12.5px] leading-relaxed text-faint">
          Choose a unique password: this preview has no password reset, MFA or email verification yet.
        </p>
      </div>

      <section
        aria-labelledby="create-account-heading"
        className="rounded-[28px] border border-line bg-surface p-6 shadow-soft sm:p-8"
      >
        <h2 id="create-account-heading" className="font-display text-[34px] leading-none">
          Create an account
        </h2>
        <p className="mt-2 text-[14px] text-muted">Takes a moment. No card, no verification email.</p>
        <div className="mt-7">
          <RegisterForm providers={providers} next={next} />
        </div>
      </section>
    </Container>
  )
}
