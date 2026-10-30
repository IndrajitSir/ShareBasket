'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface CartLine {
  slug: string
  name: string
  image: string
  pricePaise: number
  price: string
  option?: string
  quantity: number
}

interface CartState {
  lines: CartLine[]
  open: boolean
  count: number
  subtotalPaise: number
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (slug: string, option: string | undefined, quantity: number) => void
  remove: (slug: string, option?: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

const CartContext = createContext<CartState | null>(null)
const STORAGE_KEY = 'sharebasket-cart-v1'

function isLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false
  const line = value as Record<string, unknown>
  return (
    typeof line.slug === 'string' &&
    typeof line.name === 'string' &&
    typeof line.image === 'string' &&
    typeof line.pricePaise === 'number' &&
    Number.isInteger(line.pricePaise) &&
    typeof line.price === 'string' &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    (line.option === undefined || typeof line.option === 'string')
  )
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Read storage after mount so server and first client render agree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed)) setLines(parsed.filter(isLine))
      }
    } catch {
      // Corrupt storage is discarded rather than breaking the shop.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // Private-mode storage failures must not break checkout.
    }
  }, [lines, hydrated])

  const same = (line: CartLine, slug: string, option?: string) =>
    line.slug === slug && (line.option ?? '') === (option ?? '')

  const add = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((item) => same(item, line.slug, line.option))
      if (existing) {
        return current.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + quantity } : item,
        )
      }
      return [...current, { ...line, quantity }]
    })
    setOpen(true)
  }, [])

  const setQuantity = useCallback((slug: string, option: string | undefined, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((item) => !same(item, slug, option))
        : current.map((item) => (same(item, slug, option) ? { ...item, quantity } : item)),
    )
  }, [])

  const remove = useCallback((slug: string, option?: string) => {
    setLines((current) => current.filter((item) => !same(item, slug, option)))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartState>(() => {
    return {
      lines,
      open,
      add,
      setQuantity,
      remove,
      clear,
      setOpen,
      count: lines.reduce((total, line) => total + line.quantity, 0),
      subtotalPaise: lines.reduce((total, line) => total + line.quantity * line.pricePaise, 0),
    }
  }, [lines, open, add, setQuantity, remove, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside CartProvider')
  return context
}
