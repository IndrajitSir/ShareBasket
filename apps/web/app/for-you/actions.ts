'use server'

import { revalidatePath } from 'next/cache'

import type { NearbyResult } from '@/lib/recommendation-types'
import { joinGroup as joinGroupRequest, requestNearby } from '@/lib/recommendations'

export type NearbyActionResult =
  | { ok: true; result: NearbyResult }
  | { ok: false; message: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Browser geolocation is the only location source. The server re-validates the
 * ranges so a tampered client cannot turn this into a directory scan.
 */
export async function searchNearby(input: {
  latitude: number
  longitude: number
  radiusKm?: number
}): Promise<NearbyActionResult> {
  const { latitude, longitude } = input
  const radiusKm = input.radiusKm ?? 10

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, message: 'That location is not valid.' }
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, message: 'That location is not valid.' }
  }
  if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 50) {
    return { ok: false, message: 'Choose a search radius between 1 and 50 km.' }
  }

  try {
    return { ok: true, result: await requestNearby(latitude, longitude, radiusKm) }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : 'Nearby groups could not be loaded.',
    }
  }
}

export async function joinNearbyGroup(
  societyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID.test(societyId)) return { ok: false, message: 'That group is not valid.' }

  try {
    await joinGroupRequest(societyId)
    revalidatePath('/for-you')
    revalidatePath('/account')
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message ? error.message : 'You could not join this group.',
    }
  }
}
