'use client'

import { Info, Lock } from 'lucide-react'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { useCart } from '@/lib/cart'
import { formatPaise } from '@/lib/format'
import { Button, ButtonLink, Container, inputClass } from './ui'

const FREE_SHIPPING_AT_PAISE = 120000

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

export function CheckoutView() {
  const cart = useCart()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ email: '', first: '', last: '', address: '', city: '', postcode: '' })

  if (cart.lines.length === 0) {
    return (
      <Container className="pt-16 sm:pt-24">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-[44px] leading-[1.02] sm:text-[56px]">Your bag is empty</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Add a few sample products first. Checkout is a preview and will not take payment.
          </p>
          <ButtonLink href="/shop" className="mt-8">Browse the shop</ButtonLink>
        </div>
      </Container>
    )
  }

  const shippingPaise = cart.subtotalPaise >= FREE_SHIPPING_AT_PAISE ? 0 : 800
  const totalPaise = cart.subtotalPaise + shippingPaise
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value })

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[44px] sm:text-[56px]">Checkout preview</h1>
        <span className="rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-muted">No payment · no order created</span>
      </div>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
        <form onSubmit={submit} className="flex flex-col gap-10">
          <section>
            <h2 className="text-[16px] font-medium">Contact</h2>
            <Field label="Email" className="mt-4 block">
              <input type="email" required className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Delivery address</h2>
            <p className="mt-1 text-[13px] text-muted">Collected only to demonstrate the form; nothing is sent or stored.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="First name">
                <input required className={inputClass} value={form.first} onChange={set('first')} autoComplete="given-name" />
              </Field>
              <Field label="Last name">
                <input required className={inputClass} value={form.last} onChange={set('last')} autoComplete="family-name" />
              </Field>
              <Field label="Address" className="col-span-2">
                <input required className={inputClass} value={form.address} onChange={set('address')} autoComplete="street-address" />
              </Field>
              <Field label="City">
                <input required className={inputClass} value={form.city} onChange={set('city')} autoComplete="address-level2" />
              </Field>
              <Field label="Postcode">
                <input required className={inputClass} value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" />
              </Field>
            </div>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Payment</h2>
            <div className="mt-4 rounded-card border border-line bg-surface p-5">
              <div className="flex items-start gap-2 text-[14px] leading-relaxed text-muted">
                <Lock className="mt-0.5 size-4 shrink-0" />
                <p>
                  Ordering, stock reservation and payments are intentionally disabled. The API currently exposes read-only catalogue, campaign and quote endpoints, so no order can be placed and no card details are requested.
                </p>
              </div>
            </div>
          </section>

          {submitted && (
            <p role="status" className="flex items-start gap-2 rounded-card border border-line bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-accent">
              <Info className="mt-0.5 size-4 shrink-0" />
              This is a preview: your details were not submitted, no order was created and nothing was charged. Ordering will open after accounts, verified suppliers and a reviewed payment provider are in place.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg">Review preview total {formatPaise(totalPaise)}</Button>
            <Link href="/campaigns" className="text-[14px] text-muted underline underline-offset-4 hover:text-fg">Back to group buys</Link>
          </div>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">Order summary</h2>
            <ul className="mt-4 divide-y divide-line">
              {cart.lines.map((line) => (
                <li key={`${line.slug}-${line.option ?? ''}`} className="flex items-center gap-4 py-3">
                  <span className="image-frame relative size-16 shrink-0 rounded-[14px]">
                    <img src={line.image} alt="" className="size-full object-cover" />
                    <span className="round absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg">{line.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{line.name}</span>
                    {line.option && <span className="block text-[13px] text-muted">{line.option}</span>}
                  </span>
                  <span className="tabular-nums">{formatPaise(line.pricePaise * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{formatPaise(cart.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Sample shipping</dt>
                <dd className="tabular-nums">{shippingPaise === 0 ? 'Free' : formatPaise(shippingPaise)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>Preview total</dt>
                <dd className="tabular-nums">{formatPaise(totalPaise)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-faint">The preview total is calculated in the browser from catalogue prices. A real checkout must be priced and validated by the API.</p>
          </div>
        </aside>
      </div>
    </Container>
  )
}
