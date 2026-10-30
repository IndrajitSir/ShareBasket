import {
  CampaignClosedError,
  MAX_UNITS_PER_QUOTE,
  QuoteValidationError,
  formatPaise,
  getCampaignProgress,
  quoteCampaign,
  selectUnitPrice,
  type PricedCampaign,
} from '../src/campaigns/campaign-pricing'

const rice: PricedCampaign = {
  unitsCommitted: 34,
  minimumUnits: 50,
  closesAt: new Date('2026-11-05T18:00:00+05:30'),
  tiers: [
    { minimumUnits: 1, unitPricePaise: 28900 },
    { minimumUnits: 50, unitPricePaise: 26900 },
    { minimumUnits: 100, unitPricePaise: 24900 },
  ],
}

const now = new Date('2026-10-30T00:00:00+05:30')

describe('campaign tier pricing', () => {
  it('selects the current and newly reached tier price', () => {
    expect(selectUnitPrice(rice.tiers, 1)).toBe(28900)
    expect(selectUnitPrice(rice.tiers, 49)).toBe(28900)
    expect(selectUnitPrice(rice.tiers, 50)).toBe(26900)
    expect(selectUnitPrice(rice.tiers, 100)).toBe(24900)
  })

  it('is order-independent and rejects invalid quantities', () => {
    expect(selectUnitPrice([...rice.tiers].reverse(), 50)).toBe(26900)
    expect(() => selectUnitPrice(rice.tiers, -1)).toThrow(QuoteValidationError)
    expect(() => selectUnitPrice(rice.tiers, 1.5)).toThrow(QuoteValidationError)
  })

  it('requires a starting price tier', () => {
    expect(() => selectUnitPrice([], 1)).toThrow('valid starting price tier')
  })
})

describe('campaign progress', () => {
  it('reports remaining minimum and caps at a full bar', () => {
    expect(getCampaignProgress(rice)).toMatchObject({ percent: 68, unitsRemaining: 16, minimumMet: false })
    expect(getCampaignProgress({ ...rice, unitsCommitted: 90 })).toMatchObject({ percent: 100, unitsRemaining: 0, minimumMet: true })
  })

  it('reports the next tier above committed units', () => {
    expect(getCampaignProgress(rice).nextTier).toEqual({ minimumUnits: 50, unitPricePaise: 26900 })
    expect(getCampaignProgress({ ...rice, unitsCommitted: 120 }).nextTier).toBeNull()
  })
})

describe('campaign quotes', () => {
  it('prices the whole line at the tier its units would reach', () => {
    const quote = quoteCampaign(rice, 16, now)
    expect(quote).toMatchObject({
      unitsAfterCommitment: 50,
      unitPricePaise: 26900,
      lineTotalPaise: 430400,
      currentUnitPricePaise: 28900,
      unitSavingPaise: 2000,
      unitsToNextTier: 50,
    })
    expect(quote.nextTier).toEqual({ minimumUnits: 100, unitPricePaise: 24900 })
  })

  it('rejects invalid quantities, oversized quantities and closed campaigns', () => {
    expect(() => quoteCampaign(rice, 0, now)).toThrow(QuoteValidationError)
    expect(() => quoteCampaign(rice, 2.5, now)).toThrow(QuoteValidationError)
    expect(() => quoteCampaign(rice, MAX_UNITS_PER_QUOTE + 1, now)).toThrow(QuoteValidationError)
    expect(quoteCampaign(rice, MAX_UNITS_PER_QUOTE, now).quantity).toBe(MAX_UNITS_PER_QUOTE)
    expect(() => quoteCampaign({ ...rice, closesAt: new Date('2026-10-01T00:00:00+05:30') }, 5, now)).toThrow(
      CampaignClosedError,
    )
  })
})

describe('paise formatting', () => {
  it('formats integer paise as Indian rupees', () => {
    expect(formatPaise(28900)).toBe('₹289.00')
    expect(formatPaise(430400)).toBe('₹4,304.00')
  })

  it('rejects fractional and negative amounts', () => {
    expect(() => formatPaise(-1)).toThrow(RangeError)
    expect(() => formatPaise(12.5)).toThrow(RangeError)
  })
})
