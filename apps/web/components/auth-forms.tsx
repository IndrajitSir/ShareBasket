'use client'

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'

import type { AuthProviders } from '@/lib/auth-types'
import { Button } from '@/components/ui'

const fieldClass =
  'h-12 w-full rounded-control border border-line-strong bg-surface px-4 text-[15px] text-fg placeholder:text-faint transition-colors focus:border-fg focus:outline-none'

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string') return body.message
  } catch {
    // Fall through to the generic message.
  }
  return 'Something went wrong. Please try again.'
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.73.5.9 5.33.9 11.6c0 4.9 3.18 9.05 7.6 10.52.56.1.76-.24.76-.53 0-.26-.01-1.13-.02-2.05-3.09.67-3.74-1.31-3.74-1.31-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.11.08 1.7 1.14 1.7 1.14 1 1.7 2.61 1.21 3.25.93.1-.72.39-1.21.7-1.49-2.47-.28-5.06-1.23-5.06-5.48 0-1.21.43-2.2 1.14-2.98-.11-.28-.49-1.41.11-2.94 0 0 .93-.3 3.05 1.14a10.5 10.5 0 0 1 5.55 0c2.12-1.44 3.05-1.14 3.05-1.14.6 1.53.22 2.66.11 2.94.71.78 1.14 1.77 1.14 2.98 0 4.26-2.6 5.2-5.08 5.47.4.34.76 1.02.76 2.06 0 1.49-.01 2.69-.01 3.06 0 .29.2.64.77.53a10.53 10.53 0 0 0 7.58-10.52C23.1 5.33 18.27.5 12 .5Z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

function OAuthButtons({ providers }: { providers: AuthProviders }) {
  if (!providers.google && !providers.github) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-[12px] uppercase tracking-wide text-faint">
        <span className="h-px flex-1 bg-line" />
        or continue with
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.google && (
        <a
          href="/api/backend/auth/google"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-control border border-line-strong bg-surface text-[14px] font-medium transition-colors hover:border-fg"
        >
          <GoogleMark />
          Continue with Google
        </a>
      )}
      {providers.github && (
        <a
          href="/api/backend/auth/github"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-control border border-line-strong bg-surface text-[14px] font-medium transition-colors hover:border-fg"
        >
          <GithubMark />
          Continue with GitHub
        </a>
      )}
    </div>
  )
}

function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control border border-accent/25 bg-accent-soft px-4 py-3 text-[13.5px] leading-relaxed text-accent">
      {children}
    </p>
  )
}

export function LoginForm({
  providers,
  next,
  message,
}: {
  providers: AuthProviders
  next: string
  message?: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(message ?? null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/backend/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('The sign-in service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="text-[13px] font-medium">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className="text-[13px] font-medium">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            placeholder="Your password"
          />
        </div>
        {error && <AuthError>{error}</AuthError>}
        <Button type="submit" size="md" loading={loading} className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      <OAuthButtons providers={providers} />

      <p className="text-[14px] text-muted">
        New here?{' '}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-fg underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  )
}

export function RegisterForm({
  providers,
  next,
  message,
}: {
  providers: AuthProviders
  next: string
  message?: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(message ?? null)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/backend/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      router.push(next)
      router.refresh()
    } catch {
      setError('The sign-up service could not be reached. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="register-name" className="text-[13px] font-medium">Name</label>
          <input
            id="register-name"
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={fieldClass}
            placeholder="Asha Rao"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="register-email" className="text-[13px] font-medium">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="register-password" className="text-[13px] font-medium">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            placeholder="At least 8 characters"
          />
          <p className="text-[12.5px] text-muted">Use 8–72 characters. This preview does not send a verification email.</p>
        </div>
        {error && <AuthError>{error}</AuthError>}
        <Button type="submit" size="md" loading={loading} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <OAuthButtons providers={providers} />

      <p className="text-[14px] text-muted">
        Already have an account?{' '}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-fg underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    try {
      await fetch('/api/backend/auth/logout', { method: 'POST' })
    } finally {
      router.push('/')
      router.refresh()
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout} loading={loading}>
      <LogOut aria-hidden />
      Log out
    </Button>
  )
}
