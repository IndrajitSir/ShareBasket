import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import ts from 'typescript'

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('/src/data/campaigns.ts') || url.endsWith('/src/data/products.ts') || url.endsWith('/src/worker/index.ts')) {
      const source = ts.sys.readFile(new URL(url))
      if (source === undefined) throw new Error(`Unable to read ${url}`)
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
      return { format: 'module', source: output, shortCircuit: true }
    }
    return nextLoad(url, context)
  },
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier) && !/\.tsx?$/.test(specifier)) {
      for (const extension of ['.ts', '.tsx', '.js']) {
        try {
          return nextResolve(`${specifier}${extension}`, context)
        } catch (error) {
          if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
        }
      }
    }
    return nextResolve(specifier, context)
  },
})

const { campaigns, formatRupees, getCampaignProgress, getCampaignProduct, getUnitPricePaise } = await import('../src/data/campaigns.ts')
const { default: campaignApi } = await import('../src/worker/index.ts')
const jsonResponse = async (path) => {
  const request = new Request(`https://preview.example${path}`)
  return await campaignApi.request(request, {}, { ASSETS: { fetch: async () => new Response('asset') } })
}
const rice = campaigns.find((campaign) => campaign.slug === 'everyday-rice')
const oil = campaigns.find((campaign) => campaign.slug === 'cold-pressed-oil')

test('campaign tiers select the current and newly reached unit price', () => {
  assert.ok(rice)
  assert.equal(getUnitPricePaise(rice, 1), 28900)
  assert.equal(getUnitPricePaise(rice, 49), 28900)
  assert.equal(getUnitPricePaise(rice, 50), 26900)
  assert.equal(getUnitPricePaise(rice, 100), 24900)
})

test('tier pricing rejects negative and fractional quantities', () => {
  assert.ok(rice)
  assert.throws(() => getUnitPricePaise(rice, -1), RangeError)
  assert.throws(() => getUnitPricePaise(rice, 1.5), RangeError)
})

test('group progress reports remaining minimum and caps at a full bar', () => {
  assert.ok(rice && oil)
  assert.deepEqual(
    { percent: getCampaignProgress(rice).percent, unitsRemaining: getCampaignProgress(rice).unitsRemaining, minimumMet: getCampaignProgress(rice).minimumMet },
    { percent: 68, unitsRemaining: 16, minimumMet: false },
  )
  assert.equal(getCampaignProgress(oil).percent, 100)
  assert.equal(getCampaignProgress(oil).unitsRemaining, 0)
  assert.equal(getCampaignProgress(oil).minimumMet, true)
})

test('all preview campaigns reference an existing product with a valid starting tier', () => {
  assert.equal(campaigns.length, 6)
  for (const campaign of campaigns) {
    assert.ok(getCampaignProduct(campaign), `Missing product for ${campaign.slug}`)
    assert.equal(getUnitPricePaise(campaign, 1), campaign.tiers[0].unitPricePaise)
  }
})

test('formats integer paise as Indian rupees', () => {
  assert.equal(formatRupees(28900), '₹289.00')
  assert.throws(() => formatRupees(-1), RangeError)
  assert.throws(() => formatRupees(12.5), RangeError)
})

test('campaign API lists preview data with server-calculated paise and price labels', async () => {
  const response = await jsonResponse('/api/campaigns')
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.previewOnly, true)
  assert.equal(body.campaigns.length, 6)
  assert.equal(body.campaigns.find((campaign) => campaign.slug === 'everyday-rice').currentUnitPricePaise, 28900)
  assert.equal(body.campaigns.find((campaign) => campaign.slug === 'everyday-rice').currentUnitPrice, '₹289.00')
})

test('campaign API returns detail and a stable not-found response', async () => {
  const found = await jsonResponse('/api/campaigns/everyday-rice')
  assert.equal(found.status, 200)
  const detail = await found.json()
  assert.equal(detail.campaign.slug, 'everyday-rice')
  assert.equal(detail.campaign.progress.unitsRemaining, 16)
  assert.equal(detail.campaign.previewOnly, true)

  const missing = await jsonResponse('/api/campaigns/does-not-exist')
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Campaign not found.' })
})

test('campaign preview endpoints do not accept commitment writes', async () => {
  const response = await campaignApi.request(
    new Request('https://preview.example/api/campaigns/everyday-rice/commitments', { method: 'POST' }),
    {},
    { ASSETS: { fetch: async () => new Response('asset') } },
  )
  assert.equal(response.status, 404)
})
