import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ProductView } from '@/components/product-view'
import { fetchProduct, fetchProducts, type Product } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await fetchProduct(slug).catch(() => null)
  return {
    title: product?.name ?? 'Product',
    description: product?.description ?? 'Sample catalogue product.',
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await fetchProduct(slug).catch(() => null)
  if (!product) notFound()

  let related: Product[] = []
  try {
    const page = await fetchProducts({ category: product.category ?? undefined, limit: 4 })
    related = page.items.filter((item) => item.slug !== product.slug)
    if (related.length < 4) {
      const fallback = await fetchProducts({ sort: 'featured', limit: 5 })
      const seen = new Set([product.slug, ...related.map((item) => item.slug)])
      for (const item of fallback.items) {
        if (!seen.has(item.slug) && related.length < 4) {
          related.push(item)
          seen.add(item.slug)
        }
      }
    }
  } catch {
    related = []
  }

  return <ProductView product={product} related={related} />
}
