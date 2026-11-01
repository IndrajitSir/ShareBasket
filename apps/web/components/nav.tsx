'use client'

import { Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import type { AuthUser } from '@/lib/auth-types'
import { useCart } from '@/lib/cart'
import { cx } from '@/lib/cx'

const links = [
  { href: '/for-you', label: 'For you' },
  { href: '/campaigns', label: 'Group buys' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d="M9 4c0 4-3 5-3 10a6 6 0 0 0 12 0c0-5-3-6-3-10z" />
      </svg>
      <span className="font-display text-[24px] leading-none">ShareBasket</span>
    </Link>
  )
}

export function Nav() {
  const cart = useCart()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => setOpen(false), [pathname])

  // While the mobile panel is open, Escape closes it and the page behind it
  // does not scroll. Focus stays in the panel until it is dismissed.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    let cancelled = false
    fetch('/api/backend/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const data = (await response.json()) as { user?: AuthUser }
        return data.user ?? null
      })
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="flex h-9 items-center justify-center bg-fg px-4 text-center text-[12.5px] text-bg">
        <Link href="/campaigns" className="underline-offset-2 hover:underline">
          Join a group buy near you
        </Link>
      </div>
      <header className={cx('sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300', scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'bg-bg')}>
        <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-8">
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {links.map((link) => {
              const [path, search] = link.href.split('?')
              const active = pathname === path && (!search || link.href.includes(search))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx('inline-flex h-9 items-center rounded-[11px] px-3 text-[14px] transition-colors hover:bg-surface-2', active ? 'text-fg' : 'text-muted hover:text-fg')}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((current) => !current)}
            className="grid size-10 place-items-center rounded-control lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Logo />

          <div className="flex items-center justify-end gap-1">
            <form action="/shop" role="search" className="relative mr-1 hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                name="q"
                aria-label="Search products"
                placeholder="Search products"
                className="h-10 w-[150px] rounded-full border border-line-strong bg-surface pl-9 pr-3 text-[14px] text-fg placeholder:text-faint transition-[width,border-color] focus:w-[190px] focus:border-fg focus:outline-none xl:w-[200px] xl:focus:w-[240px]"
              />
              <button type="submit" className="sr-only">Search</button>
            </form>
            <Link
              href={user ? '/account' : '/login'}
              aria-label={user ? `Account, ${user.name}` : 'Sign in'}
              className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] transition-colors hover:bg-surface-2"
            >
              <UserRound className="size-5" aria-hidden />
              <span className="hidden sm:inline">{user ? user.name.split(/\s+/)[0] : 'Sign in'}</span>
            </Link>
            <button
              type="button"
              aria-label={`Bag, ${cart.count} ${cart.count === 1 ? 'item' : 'items'}`}
              onClick={() => cart.setOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] transition-colors hover:bg-surface-2"
            >
              <ShoppingBag className="size-5" aria-hidden />
              <span className="hidden sm:inline">Bag</span>
              {cart.count > 0 && (
                <span className="round grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg">
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/*
        Rendered conditionally rather than through an exit animation: the panel
        must disappear as soon as Escape or the backdrop is used, including for
        assistive technology, not 300 ms later.
      */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-fg/30 lg:hidden"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <nav
            id="mobile-navigation"
            aria-label="Mobile"
            className="absolute inset-y-2 left-2 flex w-[300px] flex-col overflow-y-auto rounded-dialog bg-bg p-5 shadow-drawer"
            onClick={(event) => event.stopPropagation()}
          >
              <div className="flex items-center justify-between">
                <Logo />
                <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-control hover:bg-surface-2">
                  <X className="size-5" />
                </button>
              </div>
              <form action="/shop" role="search" className="relative mt-6">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  name="q"
                  aria-label="Search products"
                  placeholder="Search products"
                  className="h-11 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-[15px] text-fg placeholder:text-faint focus:border-fg focus:outline-none"
                />
                <button type="submit" className="sr-only">Search</button>
              </form>
              <ul className="mt-6 flex flex-col gap-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="flex h-12 items-center rounded-control px-3 font-display text-[28px] hover:bg-surface-2">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={user ? '/account' : '/login'}
                className="mt-4 flex h-12 items-center gap-3 rounded-control border border-line-strong px-3 text-[15px]"
              >
                <UserRound className="size-5" aria-hidden />
                {user ? 'Your account' : 'Sign in'}
              </Link>
          </nav>
        </div>
      )}
    </>
  )
}
