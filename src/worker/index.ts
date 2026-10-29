import { Hono } from 'hono'

import { campaigns, formatRupees, getCampaignProduct, getCampaignProgress, getUnitPricePaise } from '../data/campaigns'

// The Worker in front of the storefront. The catalogue is static data shipped
// with the app; this handles the parts a storefront needs a server for.
type Env = { ASSETS: Fetcher }

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ ok: true }))

function campaignPreview(campaign: (typeof campaigns)[number]) {
  const product = getCampaignProduct(campaign)
  if (!product) return null

  const progress = getCampaignProgress(campaign)
  return {
    slug: campaign.slug,
    product: {
      slug: product.slug,
      name: product.name,
      category: product.category,
      image: product.image,
      description: product.description,
      short: product.short,
    },
    society: campaign.society,
    location: campaign.location,
    unitsCommitted: campaign.unitsCommitted,
    minimumUnits: campaign.minimumUnits,
    closesAt: campaign.closesAt,
    deliveryDate: campaign.deliveryDate,
    tiers: campaign.tiers,
    currentUnitPricePaise: getUnitPricePaise(campaign, campaign.unitsCommitted),
    currentUnitPrice: formatRupees(getUnitPricePaise(campaign, campaign.unitsCommitted)),
    progress: {
      percent: progress.percent,
      minimumMet: progress.minimumMet,
      unitsRemaining: progress.unitsRemaining,
      nextTier: progress.nextTier ?? null,
    },
    previewOnly: true,
  }
}

// Read-only sample data API; it does not accept commitments or expose a write path.
app.get('/api/campaigns', (c) => {
  const previews = campaigns.map(campaignPreview).filter((campaign) => campaign !== null)
  return c.json({ campaigns: previews, previewOnly: true })
})

app.get('/api/campaigns/:slug', (c) => {
  const campaign = campaigns.find((item) => item.slug === c.req.param('slug'))
  if (!campaign) return c.json({ error: 'Campaign not found.' }, 404)

  const preview = campaignPreview(campaign)
  if (!preview) return c.json({ error: 'Campaign product not found.' }, 404)
  return c.json({ campaign: preview, previewOnly: true })
})

// Demo checkout: validates the order and returns a reference. Replace the body
// with a Stripe Checkout session (server-side secret via Sites → Secrets) or
// persist orders to D1 when you connect a database.
app.post('/api/orders', async (c) => {
  const order = await c.req.json<{ email?: string; items?: { id: string; quantity: number }[] }>().catch(() => null)
  if (!order?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) return c.json({ error: 'Enter a valid email address.' }, 400)
  if (!order.items?.length) return c.json({ error: 'Your bag is empty.' }, 400)
  const reference = `YS-${Date.now().toString(36).toUpperCase().slice(-6)}`
  return c.json({ reference })
})

app.post('/api/newsletter', async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string })
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return c.json({ error: 'Enter a valid email address.' }, 400)
  return c.json({ ok: true })
})

app.all('/api/*', (c) => c.json({ error: 'API route not found.' }, 404))
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
