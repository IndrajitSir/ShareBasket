'use client'

import { Crosshair, Loader2, MapPin, Navigation, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { joinNearbyGroup, searchNearby } from '@/app/for-you/actions'
import type { MembershipStatus, NearbyGroup, NearbyResult } from '@/lib/recommendation-types'
import { Button } from './ui'

type LocationState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'ready'

const RADIUS_OPTIONS = [5, 10, 25] as const

function distanceLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

function GroupRow({
  group,
  onJoined,
}: {
  group: NearbyGroup
  onJoined: (name: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<MembershipStatus | null>(null)

  return (
    <li className="rounded-[18px] border border-line bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[22px] leading-tight">{group.name}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{group.location}</p>
        </div>
        <span className="rounded-full border border-line-strong px-2.5 py-1 text-[12px] tabular-nums text-muted">
          {distanceLabel(group.distanceKm)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <UsersRound className="size-3.5" aria-hidden />
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span>
          {group.activeCampaigns} open {group.activeCampaigns === 1 ? 'group buy' : 'group buys'}
        </span>
      </div>

      {group.topCampaign && (
        <p className="mt-3 rounded-[12px] bg-surface px-3 py-2 text-[12.5px] text-muted">
          Busiest right now: <span className="text-fg">{group.topCampaign.product.name}</span> at{' '}
          {group.topCampaign.currentUnitPrice}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {outcome ? (
          <p role="status" className="text-[13px] text-[#3d5a41]">
            {outcome === 'PENDING'
              ? `Request sent to ${group.name}. A steward will review it.`
              : `You joined ${group.name} as its first steward.`}
          </p>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            aria-label={`Ask to join ${group.name}`}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                const result = await joinNearbyGroup(group.id)
                if (result.ok) {
                  setOutcome(result.group.status)
                  onJoined(group.name)
                } else {
                  setError(result.message)
                }
              })
            }
          >
            Ask to join
          </Button>
        )}
        {error && (
          <p role="alert" className="text-[12.5px] text-accent">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * The browser's location permission is requested only from this button, never
 * on page load. Coordinates stay in component state and are sent once per
 * search to the same-origin server action.
 */
export function NearbyExplorer({ signedIn }: { signedIn: boolean }) {
  const router = useRouter()
  const [location, setLocation] = useState<LocationState>('idle')
  const [result, setResult] = useState<NearbyResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [radiusKm, setRadiusKm] = useState<(typeof RADIUS_OPTIONS)[number]>(10)
  const [pending, startTransition] = useTransition()

  function search(latitude: number, longitude: number, nextRadius: number) {
    startTransition(async () => {
      const response = await searchNearby({ latitude, longitude, radiusKm: nextRadius })
      if (response.ok) {
        setResult(response.result)
        setLocation('ready')
        setMessage(
          response.result.groups.length === 0
            ? 'No groups with a known location are open in this radius yet.'
            : null,
        )
      } else {
        setLocation('idle')
        setMessage(response.message)
      }
    })
  }

  function useMyLocation() {
    setMessage(null)
    if (!('geolocation' in navigator)) {
      setLocation('unavailable')
      setMessage('This browser cannot share a location.')
      return
    }

    setLocation('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        search(position.coords.latitude, position.coords.longitude, radiusKm)
      },
      (error) => {
        setLocation(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was declined. You can still browse every group buy without sharing it.'
            : 'Your location could not be determined. Try again in a moment.',
        )
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <section
      aria-labelledby="nearby-heading"
      className="rounded-[26px] border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 text-[12.5px] text-accent">
            <Crosshair className="size-3.5" aria-hidden /> Nearby groups
          </p>
          <h2 id="nearby-heading" className="font-display mt-2 text-[30px] leading-none">
            Find a group around you
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            We only ask for your location when you press the button. It is used once to sort groups by
            distance, never saved, and never shown to other members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Within
            <select
              value={radiusKm}
              onChange={(event) => {
                const next = Number(event.target.value) as (typeof RADIUS_OPTIONS)[number]
                setRadiusKm(next)
                setResult(null)
                setLocation('idle')
              }}
              className="h-10 rounded-control border border-line-strong bg-bg px-3 text-[13px] text-fg"
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} km
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={useMyLocation}
            loading={location === 'locating' || pending}
            disabled={signedIn === false}
          >
            <Navigation aria-hidden />
            {location === 'idle' ? 'Use my location' : 'Search again'}
          </Button>
        </div>
      </div>

      {!signedIn && (
        <p className="mt-4 rounded-[14px] border border-line bg-bg px-4 py-3 text-[13px] text-muted">
          Sign in to search for groups near you. Browsing and joining needs an account so membership
          stays yours.
        </p>
      )}

      {message && (
        <p
          role={location === 'denied' || location === 'unavailable' ? 'alert' : 'status'}
          className="mt-4 rounded-[14px] border border-line bg-accent-soft px-4 py-3 text-[13px] text-accent"
        >
          {message}
        </p>
      )}

      {result && result.groups.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {result.groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              onJoined={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      {pending && (
        <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Searching groups near you…
        </p>
      )}

      <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-faint">
        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Distances are rounded to 100 m. Sample groups use synthetic coordinates for this preview.
      </p>
    </section>
  )
}
