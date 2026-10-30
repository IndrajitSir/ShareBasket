export function formatPaise(amountPaise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export function formatClosingDate(iso: string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-IN', style === 'short' ? { month: 'short', day: 'numeric' } : { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))
}

export function formatDeliveryDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)))
}
