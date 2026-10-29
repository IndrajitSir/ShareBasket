import { Check, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { FREE_SHIPPING_AT } from '../../data/products'
import { Button, ButtonLink, Container, inputClass } from '../components/ui'
import { money, useCart } from '../lib/cart'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

export function Checkout() {
  const cart = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', first: '', last: '', address: '', city: '', postcode: '', country: 'United States' })
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')

  if (cart.items.length === 0) return <Navigate to="/shop" replace />

  const shipping = cart.subtotal >= FREE_SHIPPING_AT ? 0 : 8
  const total = cart.subtotal + shipping
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.email, items: cart.items.map((i) => ({ id: i.slug, option: i.option, quantity: i.quantity })) }),
      })
      const body = (await response.json()) as { reference?: string; error?: string }
      if (!response.ok || !body.reference) throw new Error(body.error ?? 'Something went wrong.')
      const summary = { reference: body.reference, email: form.email, items: cart.items, total }
      cart.clear()
      navigate(`/order/${body.reference}`, { state: summary })
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <h1 className="font-display text-[44px] sm:text-[56px]">Checkout</h1>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
        <form onSubmit={submit} className="flex flex-col gap-10">
          <section>
            <h2 className="text-[16px] font-medium">Contact</h2>
            <Field label="Email" className="mt-4 block">
              <input type="email" required className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
            </Field>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Shipping</h2>
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
              <Field label="Country" className="col-span-2">
                <select className={inputClass} value={form.country} onChange={set('country')} autoComplete="country-name">
                  {['United States', 'United Kingdom', 'Canada', 'Germany', 'France', 'Netherlands', 'Portugal', 'Australia'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section>
            <h2 className="text-[16px] font-medium">Payment</h2>
            <div className="mt-4 rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-[14px] text-muted">
                <Lock className="size-4" />
                This is a demo checkout. Connect Stripe in <code className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-[12.5px]">src/worker/index.ts</code> to take payments.
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 opacity-60">
                <input disabled placeholder="Card number" className={`${inputClass} col-span-2`} />
                <input disabled placeholder="MM / YY" className={inputClass} />
                <input disabled placeholder="CVC" className={inputClass} />
              </div>
            </div>
          </section>
          {state === 'error' && <p className="text-[14px] text-accent">{error}</p>}
          <Button type="submit" size="lg" loading={state === 'sending'} className="w-full sm:w-auto">
            Place order  {money(total)}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">Order summary</h2>
            <ul className="mt-4 divide-y divide-line">
              {cart.items.map((item) => (
                <li key={`${item.slug}-${item.option ?? ''}`} className="flex items-center gap-4 py-3">
                  <span className="image-frame relative size-16 shrink-0 rounded-[14px]">
                    <img src={item.product.image} alt="" className="size-full object-cover" />
                    <span className="round absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg">{item.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{item.product.name}</span>
                    {item.option && <span className="block text-[13px] text-muted">{item.option}</span>}
                  </span>
                  <span className="tabular-nums">{money(item.product.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="tabular-nums">{shipping === 0 ? 'Free' : money(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </Container>
  )
}

export function OrderConfirmed() {
  const { state } = useLocation() as { state?: { reference: string; email: string; total: number } }
  return (
    <Container className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-md text-center">
        <span className="round mx-auto grid size-14 place-items-center rounded-full bg-fg text-bg">
          <Check className="size-6" />
        </span>
        <h1 className="font-display mt-6 text-[44px] leading-[1.02] sm:text-[56px]">Thank you</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          {state ? (
            <>
              Order <span className="font-medium text-fg">{state.reference}</span> is on its way to the studio. A confirmation is heading to {state.email}.
            </>
          ) : (
            'Your order is confirmed.'
          )}
        </p>
        <ButtonLink to="/shop" variant="secondary" className="mt-8">
          Continue shopping
        </ButtonLink>
        <p className="mt-10 text-[13px] text-faint">
          Questions? <Link to="/about" className="underline underline-offset-4">Write to us</Link>
        </p>
      </div>
    </Container>
  )
}
