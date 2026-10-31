import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { LoginForm } from '@/components/auth-forms'
import { Container } from '@/components/ui'
import { getAuthProviders, getCurrentUser, safeNextPath } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to ShareBasket with email or a connected Google/GitHub account.',
}

const ERROR_MESSAGES: Record<string, string> = {
  oauth_cancelled: 'That sign-in was cancelled. You can try again or use your email.',
  oauth_state: 'That sign-in link expired or was opened in another browser. Please try again.',
  oauth_failed: 'That provider could not sign you in. Try again or use your email and password.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  if (await getCurrentUser()) redirect('/account')

  const providers = await getAuthProviders()
  const next = safeNextPath(params.next)
  const message = params.error
    ? (ERROR_MESSAGES[params.error] ?? 'Sign-in could not be completed. Please try again.')
    : undefined

  return (
    <Container className="grid gap-12 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1fr_460px] lg:items-start lg:gap-20 lg:pt-24">
      <div className="max-w-xl">
        <p className="text-[13px] uppercase tracking-[0.18em] text-accent">Your account</p>
        <h1 className="font-display mt-4 text-balance text-[46px] leading-[0.98] sm:text-[64px]">
          Welcome back to the basket.
        </h1>
        <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-muted sm:text-[17px]">
          Sign in to keep your details and join the group buys in your community. Quantities, tier prices and
          campaign progress stay the same whether you browse signed in or out.
        </p>

        <dl className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-2">
          {[
            ['Email or OAuth', 'Use a password, Google or GitHub.'],
            ['Private session', 'The session cookie is HttpOnly and never readable by page scripts.'],
            ['No payment details', 'Ordering and payments are not enabled in this preview.'],
            ['Sample data', 'Campaigns and catalogues remain illustrative.'],
          ].map(([label, detail]) => (
            <div key={label}>
              <dt className="text-[13px] font-medium">{label}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-muted">{detail}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 max-w-md text-[12.5px] leading-relaxed text-faint">
          Accounts do not yet include email verification, password reset or society membership. Do not reuse a
          sensitive password on this preview.
        </p>
      </div>

      <section
        aria-labelledby="sign-in-heading"
        className="rounded-[28px] border border-line bg-surface p-6 shadow-soft sm:p-8"
      >
        <h2 id="sign-in-heading" className="font-display text-[34px] leading-none">
          Sign in
        </h2>
        <p className="mt-2 text-[14px] text-muted">Use your email and password, or a connected provider.</p>
        <div className="mt-7">
          <LoginForm providers={providers} next={next} message={message} />
        </div>
      </section>
    </Container>
  )
}
