import '@fontsource-variable/inter'
import '@fontsource/instrument-serif'
import '@fontsource/instrument-serif/400-italic.css'
import './globals.css'

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { CartDrawer } from '@/components/cart-drawer'
import { Footer } from '@/components/footer'
import { Nav } from '@/components/nav'
import { CartProvider } from '@/lib/cart'

export const metadata: Metadata = {
  title: {
    default: 'ShareBasket — buy everyday essentials together',
    template: '%s · ShareBasket',
  },
  description:
    'Community group buying for residential societies: pooled demand, transparent quantity tiers and shared delivery. Sample campaign preview.',
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#f6f1ea',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-fg focus:px-4 focus:py-2 focus:text-bg">
          Skip to content
        </a>
        <CartProvider>
          <Nav />
          <main id="main" className="min-h-[70vh]">
            {children}
          </main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  )
}
