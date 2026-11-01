'use client'

import { BellRing, Eye,Mail } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cx } from '@/lib/cx'

const STORAGE_KEY = 'sb_settings'

interface Settings {
  unitPrices: boolean
  compactCards: boolean
  emailUpdates: boolean
  requestAlerts: boolean
}

const DEFAULTS: Settings = {
  unitPrices: true,
  compactCards: false,
  emailUpdates: false,
  requestAlerts: true,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULTS
  }
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[14.5px] font-medium">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40',
          checked ? 'border-fg bg-fg' : 'border-line-strong bg-surface-2',
        )}
      >
        <span
          className={cx(
            'round size-4 rounded-full bg-bg shadow-soft transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => setSettings(load()), [])

  function update<K extends keyof Settings>(key: K, value: boolean) {
    if (!settings) return
    const next = { ...settings, [key]: value }
    setSettings(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage full or blocked; the toggle still reflects intent for this visit.
    }
  }

  if (!settings) return <div className="h-40" aria-hidden />

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="display-heading" className="rounded-[26px] border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-accent" aria-hidden />
          <h2 id="display-heading" className="font-display text-[24px] leading-none">Display</h2>
        </div>
        <div className="mt-4 divide-y divide-line">
          <Toggle
            label="Show unit prices"
            hint="Show the per-unit price next to totals on campaign cards and quotes."
            checked={settings.unitPrices}
            onChange={(value) => update('unitPrices', value)}
          />
          <Toggle
            label="Compact cards"
            hint="Use tighter spacing and smaller images in the shop and campaign lists."
            checked={settings.compactCards}
            onChange={(value) => update('compactCards', value)}
          />
        </div>
      </section>

      <section aria-labelledby="notifications-heading" className="rounded-[26px] border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-accent" aria-hidden />
          <h2 id="notifications-heading" className="font-display text-[24px] leading-none">Notifications</h2>
        </div>
        <div className="mt-4 divide-y divide-line">
          <Toggle
            label="Group buy updates"
            hint="In-app notice when a campaign you follow reaches a new price tier."
            checked={settings.emailUpdates}
            onChange={(value) => update('emailUpdates', value)}
          />
          <Toggle
            label="Membership requests"
            hint="In-app notice when a steward approves or declines your join request."
            checked={settings.requestAlerts}
            onChange={(value) => update('requestAlerts', value)}
          />
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-[16px] border border-line bg-surface-2/60 p-3 text-[12.5px] leading-relaxed text-muted">
          <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Email delivery is not implemented yet; preferences are stored in this browser only.
        </p>
      </section>
    </div>
  )
}
