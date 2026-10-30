'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import type { Product } from '@/lib/api'
import { useCart } from '@/lib/cart'
import { cx } from '@/lib/cx'
import { formatPaise } from '@/lib/format'
import { ProductCard } from './product-card'
import { Button, Container, Stepper } from './ui'

const views = [
  { label: 'Front', style: {} },
  { label: 'Detail', style: { transform: 'scale(1.8)', transformOrigin: '50% 35%' } },
  { label: 'Texture', style: { transform: 'scale(2.4)', transformOrigin: '50% 70%' } },
]

export function ProductView({ product, related }: { product: Product; related: Product[] }) {
  const cart = useCart()
  const [option, setOption] = useState<string | undefined>(product.options?.values[0])
  const [quantity, setQuantity] = useState(1)
  const [view, setView] = useState(0)
  const [added, setAdded] = useState(false)
  const [openSection, setOpenSection] = useState<number | null>(0)

  const sections = [
    { title: 'Details', body: product.details },
    { title: 'Materials and care', body: [product.materials] },
    {
      title: 'Shipping and returns',
      body: [
        'Sample catalogue only: no shipping is arranged and no payment is taken.',
        'Delivery terms will be shown per campaign once verified suppliers are connected.',
      ],
    },
  ]

  function add() {
    cart.add(
      {
        slug: product.slug,
        name: product.name,
        image: product.image,
        pricePaise: product.pricePaise,
        price: product.price,
        option,
      },
      quantity,
    )
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Container className="pt-6 sm:pt-10">
      <Link href="/shop" className="inline-flex h-9 items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" /> Shop
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="grid grid-cols-[64px_1fr] gap-3 sm:gap-4">
          <div className="flex flex-col gap-3">
            {views.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                aria-pressed={view === index}
                onClick={() => setView(index)}
                className={cx('image-frame aspect-[3/4] rounded-[14px] border-2 transition-colors', view === index ? 'border-fg' : 'border-transparent')}
              >
                <img src={product.image} alt="" className="size-full object-cover" style={item.style} />
              </button>
            ))}
          </div>
          <div className="image-frame relative aspect-[3/4] rounded-image">
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={view}
                src={product.image}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 size-full object-cover"
                style={views[view].style}
              />
            </AnimatePresence>
            {product.badge && (
              <span className="absolute left-4 top-4 rounded-[10px] bg-surface/90 px-2.5 py-1 text-[12px] font-medium backdrop-blur">{product.badge}</span>
            )}
          </div>
        </div>

        <div className="lg:pt-4">
          <p className="text-[14px] capitalize text-muted">{product.categoryLabel ?? product.category}</p>
          <h1 className="font-display mt-2 text-[44px] leading-[1] sm:text-[56px]">{product.name}</h1>
          <p className="mt-4 text-[22px] tabular-nums">{product.price}</p>
          <p className="mt-6 text-pretty text-[16px] leading-relaxed text-muted">{product.description}</p>

          {product.options && (
            <div className="mt-8">
              <p className="text-[14px] font-medium">
                {product.options.name} <span className="ml-1 font-normal text-muted">{option}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.options.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOption(value)}
                    aria-pressed={option === value}
                    className={cx('h-10 rounded-[12px] border px-4 text-[14px] transition-colors', option === value ? 'border-fg bg-fg text-bg' : 'border-line-strong text-fg hover:border-fg')}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-[144px_1fr] gap-3">
            <Stepper value={quantity} onChange={setQuantity} />
            <Button size="md" onClick={add} className={cx('h-12 w-full', added && 'bg-accent hover:bg-accent')}>
              {added ? (
                <>
                  <Check /> Added to bag
                </>
              ) : (
                `Add to bag for ${formatPaise(product.pricePaise * quantity)}`
              )}
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-faint">Sample catalogue. No payment is taken.</p>

          <ul className="mt-10 divide-y divide-line border-y border-line">
            {sections.map((section, index) => {
              const isOpen = openSection === index
              return (
                <li key={section.title}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpenSection(isOpen ? null : index)} className="flex h-14 w-full items-center justify-between text-left text-[15px] font-medium">
                    {section.title}
                    {isOpen ? <Minus className="size-4 text-muted" /> : <Plus className="size-4 text-muted" />}
                  </button>
                  {isOpen && (
                    <ul className="flex flex-col gap-1.5 pb-5 text-[14.5px] leading-relaxed text-muted">
                      {section.body.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-24 sm:pt-32">
          <h2 className="font-display text-[36px] sm:text-[44px]">You may also like</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {related.map((item, index) => (
              <ProductCard key={item.slug} product={item} index={index} />
            ))}
          </div>
        </section>
      )}
    </Container>
  )
}
