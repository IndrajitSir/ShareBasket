import { serverApiBase } from './api'
import type {
  GroupSummary,
  MembershipStatus,
  MembershipVerificationStatus,
  SocietyRole,
  TenancyType,
} from './recommendation-types'
import { sessionCookie } from './recommendations'

export interface GroupMember {
  userId: string
  name: string
  role: SocietyRole
  verified: boolean
  verificationStatus: MembershipVerificationStatus
  joinedAt: string
}

/** The caller's own claim. Unit details are never shown for other members. */
export interface ResidenceClaim {
  status: MembershipVerificationStatus
  block: string | null
  unit: string | null
  tenancy: TenancyType | null
  submittedAt: string | null
  decidedAt: string | null
}

/** A pending claim as a steward reviews it. */
export interface VerificationRequest {
  userId: string
  name: string
  block: string | null
  unit: string
  tenancy: TenancyType
  submittedAt: string
}

export interface GroupRequest {
  userId: string
  name: string
  requestedAt: string
}

export type AuditAction =
  | 'MEMBERSHIP_REQUESTED'
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED'
  | 'MEMBERSHIP_LEFT'
  | 'ROLE_CHANGED'
  | 'STEWARD_BOOTSTRAPPED'
  | 'STEWARD_SUCCEEDED'
  | 'RESIDENCE_CLAIMED'
  | 'RESIDENCE_VERIFIED'
  | 'RESIDENCE_REJECTED'

export interface AuditEntry {
  id: string
  action: AuditAction
  actorName: string | null
  targetName: string
  fromRole: SocietyRole | null
  toRole: SocietyRole | null
  fromStatus: MembershipStatus | null
  toStatus: MembershipStatus | null
  createdAt: string
}

export interface GroupRoster {
  societyId: string
  society: { id: string; name: string; location: string; memberCount: number }
  viewerRole: SocietyRole
  members: GroupMember[]
  viewerVerification: ResidenceClaim
  /** Steward-only; empty for plain members. */
  pendingRequests: GroupRequest[]
  /** Steward-only; empty for plain members. */
  verificationQueue: VerificationRequest[]
  /** Steward-only; empty for plain members. */
  auditTrail: AuditEntry[]
}

export type RosterResult =
  | { ok: true; roster: GroupRoster }
  | { ok: false; status: number; message: string }

export type MembershipResult =
  | { ok: true; group: GroupSummary }
  | { ok: false; status: number; message: string }

export type GroupsResult =
  | { ok: true; groups: GroupSummary[] }
  | { ok: false; message: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string') return body.message
  } catch {
    // Non-JSON error body; keep the fallback.
  }
  return fallback
}

/** Every membership this account holds, including pending requests. */
export async function fetchMyGroups(): Promise<GroupsResult> {
  const session = await sessionCookie()
  if (!session) return { ok: true, groups: [] }

  let response: Response
  try {
    response = await fetch(`${serverApiBase()}/me/groups`, {
      headers: { cookie: `sb_session=${session}` },
      cache: 'no-store',
    })
  } catch {
    return { ok: false, message: 'Your groups could not be loaded right now.' }
  }

  if (!response.ok) {
    return { ok: false, message: await errorMessage(response, 'Your groups could not be loaded.') }
  }

  const body = (await response.json()) as { groups: GroupSummary[] }
  return { ok: true, groups: body.groups }
}

/**
 * The roster is fetched on the server with the first-party session cookie, so
 * the browser never holds a session token and the API stays private.
 */
export async function fetchGroupRoster(societyId: string): Promise<RosterResult> {
  if (!UUID.test(societyId)) {
    return { ok: false, status: 404, message: 'That group does not exist.' }
  }

  const session = await sessionCookie()
  if (!session) {
    return { ok: false, status: 401, message: 'Sign in to see this group.' }
  }

  let response: Response
  try {
    response = await fetch(
      `${serverApiBase()}/societies/${encodeURIComponent(societyId)}/members`,
      { headers: { cookie: `sb_session=${session}` }, cache: 'no-store' },
    )
  } catch {
    return { ok: false, status: 503, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    const messages: Record<number, string> = {
      403: 'You are not a member of this group.',
      404: 'That group does not exist.',
    }
    return {
      ok: false,
      status: response.status,
      message: messages[response.status] ?? 'The roster could not be loaded.',
    }
  }

  return { ok: true, roster: (await response.json()) as GroupRoster }
}

/**
 * The caller's own membership, including a pending request. Used only when the
 * roster is refused, to tell "waiting for approval" apart from "not a member".
 */
export async function fetchGroupMembership(societyId: string): Promise<MembershipResult> {
  if (!UUID.test(societyId)) {
    return { ok: false, status: 404, message: 'That group does not exist.' }
  }

  const session = await sessionCookie()
  if (!session) return { ok: false, status: 401, message: 'Sign in to see this group.' }

  let response: Response
  try {
    response = await fetch(`${serverApiBase()}/me/groups/${encodeURIComponent(societyId)}`, {
      headers: { cookie: `sb_session=${session}` },
      cache: 'no-store',
    })
  } catch {
    return { ok: false, status: 503, message: 'The group service is unavailable.' }
  }

  if (response.status === 404) {
    return { ok: false, status: 404, message: 'You have not asked to join this group.' }
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: await errorMessage(response, 'This group could not be loaded.'),
    }
  }

  const body = (await response.json()) as { group: GroupSummary }
  return { ok: true, group: body.group }
}

/** Steward-only. The API re-checks the role, so the UI cannot grant one. */
export async function changeGroupMemberRole(
  societyId: string,
  userId: string,
  role: SocietyRole,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId) || !UUID.test(userId)) {
    return { ok: false, message: 'That member could not be found.' }
  }

  const session = await sessionCookie()
  if (!session) return { ok: false, message: 'Sign in to manage this group.' }

  let response: Response
  try {
    response = await fetch(
      `${serverApiBase()}/societies/${encodeURIComponent(societyId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie: `sb_session=${session}` },
        body: JSON.stringify({ role }),
        cache: 'no-store',
      },
    )
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    return { ok: false, message: await errorMessage(response, 'That change was not allowed.') }
  }

  return { ok: true }
}

/** Steward-only decision on a pending request. */
export async function decideGroupRequest(
  societyId: string,
  userId: string,
  decision: 'approve' | 'reject',
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId) || !UUID.test(userId)) {
    return { ok: false, message: 'That request could not be found.' }
  }

  const session = await sessionCookie()
  if (!session) return { ok: false, message: 'Sign in to review requests.' }

  const path =
    decision === 'approve'
      ? `/societies/${encodeURIComponent(societyId)}/requests/${encodeURIComponent(userId)}/approve`
      : `/societies/${encodeURIComponent(societyId)}/requests/${encodeURIComponent(userId)}`

  let response: Response
  try {
    response = await fetch(`${serverApiBase()}${path}`, {
      method: decision === 'approve' ? 'POST' : 'DELETE',
      headers: { cookie: `sb_session=${session}` },
      cache: 'no-store',
    })
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    return { ok: false, message: await errorMessage(response, 'That decision was not allowed.') }
  }

  return { ok: true }
}

/** A member declares their residence for steward review. */
export async function submitGroupResidence(
  societyId: string,
  input: { block?: string; unit: string; tenancy: TenancyType },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId)) return { ok: false, message: 'That group is not valid.' }

  const session = await sessionCookie()
  if (!session) return { ok: false, message: 'Sign in to verify your residence.' }

  let response: Response
  try {
    response = await fetch(
      `${serverApiBase()}/societies/${encodeURIComponent(societyId)}/verification`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `sb_session=${session}` },
        body: JSON.stringify({ ...input, attested: true }),
        cache: 'no-store',
      },
    )
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    return {
      ok: false,
      message: await errorMessage(response, 'Your residence claim could not be submitted.'),
    }
  }

  return { ok: true }
}

/** Steward-only decision on a residence claim. */
export async function decideGroupResidence(
  societyId: string,
  userId: string,
  decision: 'verify' | 'reject',
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId) || !UUID.test(userId)) {
    return { ok: false, message: 'That residence claim could not be found.' }
  }

  const session = await sessionCookie()
  if (!session) return { ok: false, message: 'Sign in to review residence claims.' }

  let response: Response
  try {
    response = await fetch(
      `${serverApiBase()}/societies/${encodeURIComponent(societyId)}/verification/${encodeURIComponent(userId)}/${decision}`,
      {
        method: 'POST',
        headers: { cookie: `sb_session=${session}` },
        cache: 'no-store',
      },
    )
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    return {
      ok: false,
      message: await errorMessage(response, 'That decision was not allowed.'),
    }
  }

  return { ok: true }
}

/** A requester can withdraw their own pending request at any time. */
export async function cancelGroupRequest(
  societyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId)) return { ok: false, message: 'That group is not valid.' }

  const session = await sessionCookie()
  if (!session) return { ok: false, message: 'Sign in to manage this request.' }

  let response: Response
  try {
    response = await fetch(`${serverApiBase()}/me/groups/${encodeURIComponent(societyId)}`, {
      method: 'DELETE',
      headers: { cookie: `sb_session=${session}` },
      cache: 'no-store',
    })
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    return { ok: false, message: await errorMessage(response, 'That request could not be cancelled.') }
  }

  return { ok: true }
}
