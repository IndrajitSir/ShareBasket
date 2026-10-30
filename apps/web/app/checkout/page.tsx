import type { Metadata } from 'next'

import { CheckoutView } from '@/components/checkout-view'

export const metadata: Metadata = {
  title: 'Checkout preview',
  description: 'Preview checkout. Ordering and payments are not enabled.',
}

export default function CheckoutPage() {
  return <CheckoutView />
}
