// Formats for what the shell shows. Amounts are cents and read as euros
// the French way, as Lanterne writes them; dates are ISO days, shown and
// typed in the app's locale.

// The app's locale: how its days are written, shown and typed alike, so a
// date field reads 16/10/2026 whatever the browser's own language.
export const locale = 'en-GB'

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const days = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const money = (cents: unknown) =>
  cents === null || cents === undefined || cents === '' ? '—' : euros.format(Number(cents) / 100)

export const date = (iso: unknown) => {
  if (!iso) {
    return '—'
  }
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(iso) : days.format(d)
}

const months = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })

// A `YYYY-MM` month, as a chart's axis reads it.
export const month = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ym : months.format(d)
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

// A power by its plain name: `approve-expense` reads "Approve expense".
export const power = (code: unknown) => {
  const words = String(code ?? '').replaceAll('-', ' ')
  return words ? words[0].toUpperCase() + words.slice(1) : '—'
}

// A day as the locale types it, in figures: its parts' order and the
// marks between them.
const figures = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const parts = figures.formatToParts(new Date(Date.UTC(2026, 9, 16)))
const order = parts.flatMap((p) => (p.type === 'day' || p.type === 'month' || p.type === 'year' ? [p.type] : []))

// How a date field asks for a day, as dd/mm/yyyy in en-GB.
export const dayPattern = parts.map((p) => ({ day: 'dd', month: 'mm', year: 'yyyy' } as Record<string, string>)[p.type] ?? p.value).join('')

// An ISO day as a date field shows it.
export const typed = (iso: unknown) => {
  const d = new Date(`${String(iso ?? '').slice(0, 10)}T00:00:00Z`)
  return iso && !Number.isNaN(d.getTime()) ? figures.format(d) : ''
}

// What was typed into a date field as an ISO day: in the locale's order,
// or as an ISO day itself; null where it names no day.
export const parsed = (text: string): string | null => {
  const n = text.trim().split(/\D+/).filter(Boolean)
  if (n.length !== 3) {
    return null
  }
  const at = n[0].length === 4 ? { year: n[0], month: n[1], day: n[2] } : Object.fromEntries(order.map((k, i) => [k, n[i]]))
  const [y, m, d] = [Number(at.year), Number(at.month), Number(at.day)]
  const day = new Date(Date.UTC(y, m - 1, d))
  if (at.year.length !== 4 || day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) {
    return null
  }
  return day.toISOString().slice(0, 10)
}
