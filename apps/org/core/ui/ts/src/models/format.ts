// Formats for what the shell shows. Amounts are cents and read as euros
// the French way, as Lanterne writes them; dates are ISO days.

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const days = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const money = (cents: unknown) =>
  cents === null || cents === undefined || cents === '' ? '—' : euros.format(Number(cents) / 100)

export const date = (iso: unknown) => {
  if (!iso) {
    return '—'
  }
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(iso) : days.format(d)
}

// A hash or key, shortened to its head.
export const short = (hex: unknown, n = 10) => (hex ? `${String(hex).slice(0, n)}…` : '—')

export function show(value: unknown, kind?: string): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  switch (kind) {
    case 'money':
      return money(value)
    case 'date':
      return date(value)
    default:
      return String(value)
  }
}
