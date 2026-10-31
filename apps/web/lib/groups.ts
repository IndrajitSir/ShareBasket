import { serverApiBase } from './api'
import type { SocietyRole } from './recommendation-types'
import { sessionCookie } from './recommendations'

export interface GroupMember {
  userId: string
  name: string
  role: SocietyRole
  joinedAt: string
}

export interface GroupRoster {
  societyId: string
  society: { id: string; name: string; location: string; memberCount: number }
  viewerRole: SocietyRole
  members: GroupMember[]
}

export type RosterResult =
  | { ok: true; roster: GroupRoster }
  | { ok: false; status: number; message: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
      {
        headers: { cookie: `sb_session=${session}` },
        cache: 'no-store',
      },
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
        headers: {
          'content-type': 'application/json',
          cookie: `sb_session=${session}`,
        },
        body: JSON.stringify({ role }),
        cache: 'no-store',
      },
    )
  } catch {
    return { ok: false, message: 'The group service is unavailable.' }
  }

  if (!response.ok) {
    let message = 'That change was not allowed.'
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    return { ok: false, message }
  }

  return { ok: true }
}
