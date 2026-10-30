/**
 * Pure campaign pricing rules. No persistence or HTTP concerns live here so
 * the same rules can be unit-tested and reused by future order services.
 *
 * Money is always an integer number of paise.
 */

export interface PriceTier {
  minimumUnits: number
  unitPricePaise: number
}

export interface PricedCampaign {
  unitsCommitted: number
  minimumUnits: number
  closesAt: Date
  tiers: PriceTier[]
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
}

export const MAX_UNITS_PER_QUOTE = 20

export class QuoteValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuoteValidationError'
  }
}

export class CampaignClosedError extends Error {
  constructor(message = 'This campaign has closed.') {
    super(message)
    this.name = 'CampaignClosedError'
  }
}

function orderedTiers(tiers: PriceTier[]): PriceTier[] {
  return [...tiers].sort((left, right) => left.minimumUnits - right.minimumUnits)
}

export function assertPaise(amount: number, label: string): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of paise.`)
  }
}

/** The whole line is priced at the highest threshold the total units reach. */
export function selectUnitPrice(tiers: PriceTier[], totalUnits: number): number {
  if (!Number.isInteger(totalUnits) || totalUnits < 0) {
    throw new QuoteValidationError('Total units must be a non-negative whole number.')
  }

  const tier = orderedTiers(tiers)
    .filter((candidate) => candidate.minimumUnits <= totalUnits)
    .at(-1)

  if (!tier || !Number.isInteger(tier.unitPricePaise) || tier.unitPricePaise <= 0) {
    throw new Error('Campaign must define a valid starting price tier.')
  }

  return tier.unitPricePaise
}

export function getCampaignProgress(campaign: PricedCampaign) {
  if (!Number.isInteger(campaign.minimumUnits) || campaign.minimumUnits < 1) {
    throw new Error('Campaign minimum units must be a positive whole number.')
  }

  const nextTier =
    orderedTiers(campaign.tiers).find((tier) => tier.minimumUnits > campaign.unitsCommitted) ?? null

  return {
    targetUnits: campaign.minimumUnits,
    percent: Math.min(
      100,
      Math.max(0, Math.round((campaign.unitsCommitted / campaign.minimumUnits) * 100)),
    ),
    minimumMet: campaign.unitsCommitted >= campaign.minimumUnits,
    unitsRemaining: Math.max(0, campaign.minimumUnits - campaign.unitsCommitted),
    nextTier,
  }
}

export function quoteCampaign(
  campaign: PricedCampaign,
  quantity: number,
  now: Date = new Date(),
): CampaignQuote {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new QuoteValidationError('Quantity must be a whole number of at least 1.')
  }
  if (quantity > MAX_UNITS_PER_QUOTE) {
    throw new QuoteValidationError(
      `Quantity cannot exceed ${MAX_UNITS_PER_QUOTE} units per household.`,
    )
  }
  if (now.getTime() >= campaign.closesAt.getTime()) {
    throw new CampaignClosedError()
  }

  const unitsAfterCommitment = campaign.unitsCommitted + quantity
  const unitPricePaise = selectUnitPrice(campaign.tiers, unitsAfterCommitment)
  const currentUnitPricePaise = selectUnitPrice(campaign.tiers, campaign.unitsCommitted)
  const nextTier =
    orderedTiers(campaign.tiers).find((tier) => tier.minimumUnits > unitsAfterCommitment) ?? null

  return {
    quantity,
    unitPricePaise,
    lineTotalPaise: unitPricePaise * quantity,
    currentUnitPricePaise,
    unitSavingPaise: currentUnitPricePaise - unitPricePaise,
    unitsAfterCommitment,
    nextTier,
    unitsToNextTier: nextTier ? nextTier.minimumUnits - unitsAfterCommitment : null,
  }
}

export function formatPaise(amountPaise: number): string {
  assertPaise(amountPaise, 'Amount')

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}
