import { SlidersHorizontal } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ProductCard } from '@/components/product-card'
import { Container } from '@/components/ui'
import { fetchCategories, fetchProducts, type Category, type Product } from '@/lib/api'
import { cx } from '@/lib/cx'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Sample catalogue of household essentials and homeware served by the ShareBasket API.',
}

const priceOptions = [
  { key: '', label: 'Any price' },
  { key: '0-10000', label: 'Under ₹100' },
  { key: '10000-25000', label: '₹100 to ₹250' },
  { key: '25000-', label: 'Over ₹250' },
]

const sortOptions = [
  { key: 'featured', label: 'Featured' },
  { key: 'new', label: 'Newest' },
  { key: 'price-asc', label: 'Price, low to high' },
  { key: 'price-desc', label: 'Price, high to low' },
]

type SearchParams = Promise<{ category?: string; price?: string; sort?: string }>

function parsePrice(value: string | undefined): { min?: number; max?: number; key: string } {
  const option = priceOptions.find((item) => item.key && item.key === value)
  if (!option) return { key: '' }
  const [min, max] = option.key.split('-')
  return {
    key: option.key,
    min: min ? Number(min) : undefined,
    max: max ? Number(max) : undefined,
  }
}

function hrefWith(current: Record<string, string | undefined>, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...current, ...changes })) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `/shop?${query}` : '/shop'
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const price = parsePrice(params.price)
  const sort = sortOptions.some((item) => item.key === params.sort) ? (params.sort as string) : 'featured'
  const category = params.category?.slice(0, 40) ?? ''

  let items: Product[] = []
  let categories: Category[] = []
  let total = 0
  let unavailable = false

  try {
    const [page, categoryList] = await Promise.all([
      fetchProducts({
        category: category || undefined,
        sort,
        limit: 60,
        minPricePaise: price.min,
        maxPricePaise: price.max,
      }),
      fetchCategories(),
    ])
    items = page.items
    total = page.page.total
    categories = categoryList
  } catch {
    unavailable = true
  }

  const current = { category: category || undefined, price: price.key || undefined, sort: sort === 'featured' ? undefined : sort }
  const title = categories.find((item) => item.key === category)?.label ?? 'All products'
  const activeCount = (category ? 1 : 0) + (price.key ? 1 : 0)

  const filters = (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-[13px] font-medium">Category</p>
        <ul className="mt-3 flex flex-col gap-0.5">
          {[{ key: '', label: 'Everything', productCount: total }, ...categories].map((option) => {
            const active = category === option.key
            return (
              <li key={option.key || 'all'}>
                <Link
                  href={hrefWith(current, { category: option.key || undefined })}
                  aria-current={active ? 'true' : undefined}
                  className={cx('flex h-9 w-full items-center gap-2 rounded-[11px] px-2.5 text-[14px] transition-colors', active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
                >
                  {option.label}
                  <span className="ml-auto text-[12.5px] tabular-nums text-faint">{option.productCount}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <p className="text-[13px] font-medium">Price</p>
        <ul className="mt-3 flex flex-col gap-0.5">
          {priceOptions.map((option) => {
            const active = price.key === option.key
            return (
              <li key={option.key || 'any'}>
                <Link
                  href={hrefWith(current, { price: option.key || undefined })}
                  aria-current={active ? 'true' : undefined}
                  className={cx('flex h-9 w-full items-center rounded-[11px] px-2.5 text-[14px] transition-colors', active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}
                >
                  {option.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )

  return (
    <Container className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted">Shop</p>
          <h1 className="font-display mt-2 text-[44px] sm:text-[56px]">
            {title} <span className="text-[24px] text-faint">{items.length}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Sort products">
          <SlidersHorizontal className="mr-1 size-4 text-muted lg:hidden" aria-hidden />
          {sortOptions.map((option) => {
            const active = sort === option.key
            return (
              <Link
                key={option.key}
                href={hrefWith(current, { sort: option.key === 'featured' ? undefined : option.key })}
                aria-current={active ? 'true' : undefined}
                className={cx('rounded-full px-3 py-2 text-[13px] transition-colors', active ? 'bg-fg text-bg' : 'border border-line-strong text-muted hover:text-fg')}
              >
                {option.label}
              </Link>
            )
          })}
        </div>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        {activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active · ` : ''}
        {total} sample products
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-24">{filters}</div>
        </aside>
        <div>
          {unavailable && (
            <p className="rounded-card border border-line bg-accent-soft px-5 py-4 text-[14px] text-accent" role="status">
              Products could not be loaded from the API. Check that the API service is running.
            </p>
          )}

          {!unavailable && items.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 xl:grid-cols-3 xl:gap-x-6">
              {items.map((product, index) => (
                <ProductCard key={product.slug} product={product} index={index} />
              ))}
            </div>
          )}

          {!unavailable && items.length === 0 && (
            <div className="py-24 text-center">
              <p className="font-display text-[32px]">Nothing in this range yet</p>
              <p className="mt-2 text-[14px] text-muted">Try a different category or price range.</p>
              <Link href="/shop" className="mt-6 inline-flex rounded-control border border-line-strong px-5 py-3 text-[14px]">Clear filters</Link>
            </div>
          )}
        </div>
      </div>

      <details className="mt-8 rounded-card border border-line bg-surface p-5 lg:hidden">
        <summary className="cursor-pointer text-[14px] font-medium">Filters{activeCount > 0 ? ` (${activeCount})` : ''}</summary>
        <div className="mt-5">{filters}</div>
      </details>
    </Container>
  )
}
