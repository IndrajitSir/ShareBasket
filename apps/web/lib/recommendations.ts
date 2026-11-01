import { cookies } from 'next/headers'

import { serverApiBase } from './api'
import type { GroupSummary, NearbyResult, Recommendations } from './recommendation-types'

/** The first-party session cookie is set by the auth proxy on this origin. */
export async function sessionCookie(): Promise<string | undefined> {
  return (await cookies()).get('sb_session')?.value
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    try {
      const body = (await response.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

/** Recommendations are computed per request; there is no shared cache. */
export async function fetchRecommendations(): Promise<Recommendations> {
  const session = await sessionCookie()
  const response = await fetch(`${serverApiBase()}/recommendations/for-you`, {
    headers: session ? { cookie: `sb_session=${session}` } : {},
    cache: 'no-store',
  })
  return readJson<Recommendations>(response)
}

/** Coordinates are forwarded in a POST body and never stored by the web app. */
export async function requestNearby(
  latitude: number,
  longitude: number,
  radiusKm = 10,
): Promise<NearbyResult> {
  const session = await sessionCookie()
  const response = await fetch(`${serverApiBase()}/recommendations/nearby`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(session ? { cookie: `sb_session=${session}` } : {}),
    },
    body: JSON.stringify({ latitude, longitude, radiusKm }),
    cache: 'no-store',
  })
  return readJson<NearbyResult>(response)
}

/**
 * Join, or ask to join. The API decides which: a group with members records a
 * PENDING request, an empty one bootstraps the caller as its steward.
 */
export async function joinGroup(societyId: string): Promise<GroupSummary> {
  const session = await sessionCookie()
  const response = await fetch(`${serverApiBase()}/me/groups/${encodeURIComponent(societyId)}`, {
    method: 'POST',
    headers: session ? { cookie: `sb_session=${session}` } : {},
    cache: 'no-store',
  })
  const body = await readJson<{ group: GroupSummary }>(response)
  return body.group
}
