/** Shapes returned by `GET /api/v1/recommendations/for-you`. */

export type RecommendationSource = 'YOUR_GROUPS' | 'OTHER_GROUPS' | 'TRENDING'

export interface RecommendedCampaign {
  slug: string
  product: {
    slug: string
    name: string
    image: string
    category: string
  }
  society: { id: string; name: string; location: string }
  currentUnitPricePaise: number
  currentUnitPrice: string
  unitsCommitted: number
  minimumUnits: number
  progressPercent: number
  closesAt: string
  deliveryDate?: string
  reason: string
  source: RecommendationSource
}

/** Scoped to one society; never a platform-wide role. */
export type SocietyRole = 'MEMBER' | 'STEWARD'

/** A request grants no access until a steward approves it. */
export type MembershipStatus = 'PENDING' | 'ACTIVE'

/** Residence verification, independent of membership approval. */
export type MembershipVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'

export type TenancyType = 'OWNER' | 'TENANT' | 'FAMILY'

export interface GroupSummary {
  id: string
  name: string
  location: string
  memberCount: number
  activeCampaigns: number
  role: SocietyRole
  status: MembershipStatus
  /** Steward-only count of requests waiting for review. */
  pendingRequests: number
  /** When a pending request was made; null once active. */
  requestedAt: string | null
  verificationStatus: MembershipVerificationStatus
}

export interface Recommendations {
  signedIn: boolean
  personalized: boolean
  needsGroup: boolean
  needsLocation: boolean
  groups: GroupSummary[]
  sections: {
    inYourGroups: RecommendedCampaign[]
    otherGroups: RecommendedCampaign[]
    trending: RecommendedCampaign[]
  }
  model: { name: string; version: string; generatedAt: string }
}

export interface NearbyGroup {
  id: string
  name: string
  location: string
  distanceKm: number
  memberCount: number
  activeCampaigns: number
  topCampaign: RecommendedCampaign | null
}

export interface NearbyResult {
  radiusKm: number
  groups: NearbyGroup[]
}

export type NearbyActionState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'ready'; result: NearbyResult }
  | { status: 'error'; message: string }
