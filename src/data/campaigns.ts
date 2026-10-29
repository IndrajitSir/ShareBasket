import { products } from './products'

export interface PriceTier {
  minimumUnits: number
  unitPricePaise: number
}

export interface Campaign {
  slug: string
  productSlug: string
  society: string
  location: string
  unitsCommitted: number
  minimumUnits: number
  closesAt: string
  deliveryDate: string
  tiers: PriceTier[]
}

// Sample preview data only. These commitments are not live orders or inventory.
export const campaigns: Campaign[] = [
  {
    slug: 'everyday-rice',
    productSlug: 'basmati-rice',
    society: 'Maple Residency',
    location: 'Bengaluru · Whitefield',
    unitsCommitted: 34,
    minimumUnits: 50,
    closesAt: '2026-11-05T18:00:00+05:30',
    deliveryDate: 'Nov 8',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 28900 },
      { minimumUnits: 50, unitPricePaise: 26900 },
      { minimumUnits: 100, unitPricePaise: 24900 },
    ],
  },
  {
    slug: 'filter-coffee',
    productSlug: 'filter-coffee',
    society: 'Lakeview Enclave',
    location: 'Bengaluru · Bellandur',
    unitsCommitted: 22,
    minimumUnits: 40,
    closesAt: '2026-11-07T18:00:00+05:30',
    deliveryDate: 'Nov 10',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 39900 },
      { minimumUnits: 40, unitPricePaise: 36900 },
      { minimumUnits: 80, unitPricePaise: 33900 },
    ],
  },
  {
    slug: 'cold-pressed-oil',
    productSlug: 'cold-pressed-oil',
    society: 'Maple Residency',
    location: 'Bengaluru · Whitefield',
    unitsCommitted: 61,
    minimumUnits: 60,
    closesAt: '2026-11-03T18:00:00+05:30',
    deliveryDate: 'Nov 6',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 32500 },
      { minimumUnits: 60, unitPricePaise: 29900 },
      { minimumUnits: 120, unitPricePaise: 27900 },
    ],
  },
  {
    slug: 'oat-milk-case',
    productSlug: 'oat-milk-case',
    society: 'Cedar Gardens',
    location: 'Bengaluru · Sarjapur Road',
    unitsCommitted: 16,
    minimumUnits: 30,
    closesAt: '2026-11-09T18:00:00+05:30',
    deliveryDate: 'Nov 12',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 22500 },
      { minimumUnits: 30, unitPricePaise: 20900 },
      { minimumUnits: 60, unitPricePaise: 18900 },
    ],
  },
  {
    slug: 'household-lentils',
    productSlug: 'toor-dal',
    society: 'Lakeview Enclave',
    location: 'Bengaluru · Bellandur',
    unitsCommitted: 18,
    minimumUnits: 40,
    closesAt: '2026-11-12T18:00:00+05:30',
    deliveryDate: 'Nov 15',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 19500 },
      { minimumUnits: 40, unitPricePaise: 17900 },
      { minimumUnits: 80, unitPricePaise: 16500 },
    ],
  },
  {
    slug: 'breakfast-eggs',
    productSlug: 'free-range-eggs',
    society: 'Cedar Gardens',
    location: 'Bengaluru · Sarjapur Road',
    unitsCommitted: 42,
    minimumUnits: 60,
    closesAt: '2026-11-06T18:00:00+05:30',
    deliveryDate: 'Nov 9',
    tiers: [
      { minimumUnits: 1, unitPricePaise: 17900 },
      { minimumUnits: 60, unitPricePaise: 15900 },
      { minimumUnits: 120, unitPricePaise: 14500 },
    ],
  },
]

export function getCampaignProduct(campaign: Campaign) {
  return products.find((product) => product.slug === campaign.productSlug)
}

export function getUnitPricePaise(campaign: Campaign, totalUnits: number): number {
  if (!Number.isInteger(totalUnits) || totalUnits < 0) {
    throw new RangeError('Total units must be a non-negative integer.')
  }

  const tier = [...campaign.tiers]
    .sort((left, right) => left.minimumUnits - right.minimumUnits)
    .filter((candidate) => candidate.minimumUnits <= totalUnits)
    .at(-1)

  if (!tier || !Number.isInteger(tier.unitPricePaise) || tier.unitPricePaise < 0) {
    throw new RangeError('Campaign must define a valid starting price tier.')
  }

  return tier.unitPricePaise
}

export function getCampaignProgress(campaign: Campaign) {
  const nextTier = [...campaign.tiers]
    .sort((left, right) => left.minimumUnits - right.minimumUnits)
    .find((tier) => tier.minimumUnits > campaign.unitsCommitted)
  const targetUnits = campaign.minimumUnits

  return {
    targetUnits,
    percent: Math.min(100, Math.max(0, Math.round((campaign.unitsCommitted / targetUnits) * 100))),
    minimumMet: campaign.unitsCommitted >= campaign.minimumUnits,
    unitsRemaining: Math.max(0, campaign.minimumUnits - campaign.unitsCommitted),
    nextTier,
  }
}

export function formatRupees(amountPaise: number): string {
  if (!Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new RangeError('Amount must be a non-negative integer number of paise.')
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}
