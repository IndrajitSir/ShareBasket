import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'

import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { Nav } from './components/Nav'
import { CartProvider } from './lib/cart'
import { About } from './pages/About'
import { CampaignDetail } from './pages/CampaignDetail'
import { Campaigns } from './pages/Campaigns'
import { Checkout, OrderConfirmed } from './pages/Checkout'
import { Home } from './pages/Home'
import { Product } from './pages/Product'
import { Shop } from './pages/Shop'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

function Pages() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[70vh]"
      >
        <Routes location={location}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:slug" element={<CampaignDetail />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:reference" element={<OrderConfirmed />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <ScrollToTop />
        <Nav />
        <Pages />
        <Footer />
        <CartDrawer />
      </CartProvider>
    </BrowserRouter>
  )
}
