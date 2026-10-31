/**
 * Typed client for the NestJS API. Server components use `API_URL` (an
 * internal hostname in Docker); browser code uses `NEXT_PUBLIC_API_URL`.
 */

export interface PriceTier {
  minimumUnits: number
  unitPricePaise: number
}

export interface ProductOptions {
  name: string
  values: string[]
}

export interface Product {
  slug: string
  name: string
  category: string | null
  categoryLabel: string | null
  pricePaise: number
  price: string
  compareAtPaise: number | null
  compareAt: string | null
  image: string
  badge: string | null
  short: string
  description: string
  details: string[]
  materials: string
  options: ProductOptions | null
  featured: boolean
}

export interface ProductPage {
  items: Product[]
  page: { limit: number; offset: number; total: number }
}

export interface CampaignProduct {
  slug: string
  name: string
  category: string | null
  image: string
  description: string
  short: string
}

export interface Campaign {
  slug: string
  product: CampaignProduct | null
  society: string
  location: string
  unitsCommitted: number
  minimumUnits: number
  closesAt: string
  deliveryDate: string
  status: 'OPEN' | 'CLOSED' | 'CANCELLED'
  isClosed: boolean
  tiers: PriceTier[]
  currentUnitPricePaise: number
  currentUnitPrice: string
  progress: {
    percent: number
    minimumMet: boolean
    unitsRemaining: number
    nextTier: PriceTier | null
  }
}

export interface Category {
  key: string
  label: string
  blurb: string
  image: string
  productCount: number
}

export interface CampaignQuote {
  quantity: number
  unitPricePaise: number
  lineTotalPaise: number
  currentUnitPricePaise: number
  unitSavingPaise: number
  unitsAfterCommitment: number
  nextTier: PriceTier | null
  unitsToNextTier: number | null
  unitPrice: string
  lineTotal: string
  currentUnitPrice: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const DEFAULT_API_BASE = 'http://localhost:4000/api/v1'

export function apiBase(): string {
  // `process.env.NEXT_PUBLIC_API_URL` is inlined by Next for browser bundles.
  return (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).replace(/\/$/, '')
}

export function serverApiBase(): string {
  return (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE).replace(/\/$/, '')
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}.`
  let code = 'ERROR'
  try {
    const body = (await response.json()) as { message?: unknown; code?: unknown }
    if (typeof body.message === 'string') message = body.message
    if (typeof body.code === 'string') code = body.code
  } catch {
    // Non-JSON error body; keep the generic message.
  }
  return new ApiError(response.status, code, message)
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${serverApiBase()}${path}`, { cache: 'no-store' })
  if (!response.ok) throw await parseError(response)
  return (await response.json()) as T
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export async function fetchCampaigns(
  params: { category?: string; society?: string; q?: string; sort?: string } = {},
): Promise<Campaign[]> {
  const data = await getJson<{ campaigns: Campaign[] }>(`/campaigns${query(params)}`)
  return data.campaigns
}

export async function fetchCampaign(slug: string): Promise<Campaign | null> {
  try {
    const data = await getJson<{ campaign: Campaign }>(`/campaigns/${encodeURIComponent(slug)}`)
    return data.campaign
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function fetchProducts(
  params: {
    category?: string
    q?: string
    sort?: string
    limit?: number
    offset?: number
    minPricePaise?: number
    maxPricePaise?: number
  } = {},
): Promise<ProductPage> {
  return getJson<ProductPage>(`/products${query(params)}`)
}

export async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const data = await getJson<{ product: Product }>(`/products/${encodeURIComponent(slug)}`)
    return data.product
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await getJson<{ categories: Category[] }>('/categories')
  return data.categories
}

/** Browser-side quote request; always creates no commitment. */
export async function postQuote(slug: string, quantity: number): Promise<CampaignQuote> {
  const response = await fetch(`${apiBase()}/campaigns/${encodeURIComponent(slug)}/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })
  if (!response.ok) throw await parseError(response)
  const data = (await response.json()) as { quote: CampaignQuote }
  return data.quote
}
