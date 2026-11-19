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

const figure = new Intl.NumberFormat(locale)

// A whole figure, grouped by thousands in the locale: a collection's
// count, a tally's whole.
export const count = (n: unknown) => (n === null || n === undefined || n === '' ? '—' : figure.format(Number(n)))

const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

// A fraction of a whole, already in hundreds (12.5 reads 12.5%): a
// margin, a share, a burn.
export const percent = (n: unknown) => (n === null || n === undefined || n === '' ? '—' : `${pct.format(Number(n))}%`)

const hoursFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })

// A duration in hours: a timesheet's entry, a project's time cost.
export const hours = (n: unknown) => (n === null || n === undefined || n === '' ? '—' : `${hoursFmt.format(Number(n))} h`)

const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })

// A day's name alone, short, as a week's header names it.
export const weekday = (iso: unknown) => {
  if (!iso) {
    return '—'
  }
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? String(iso) : weekdayFmt.format(d)
}

// A day and its wall-clock time together, as a meeting's moment reads: the
// day as `date` shows it, then its `HH:MM`, never shifted by a time zone,
// since the time is the scope's own clock, not an instant.
export const when = (at: unknown) => {
  if (!at) {
    return '—'
  }
  const s = String(at)
  const day = date(s.slice(0, 10))
  const time = s.length > 10 ? s.slice(11, 16) : undefined
  return time ? `${day}, ${time}` : day
}

// A size in bytes as a reader reads it: 812 bytes, 24 KB, 1.2 MB.
export const bytes = (n: unknown) => {
  if (n === null || n === undefined || n === '') {
    return '—'
  }
  const b = Number(n)
  if (b < 1000) {
    return `${b} ${b === 1 ? 'byte' : 'bytes'}`
  }
  const units = ['KB', 'MB', 'GB']
  let v = b / 1000
  let u = 0
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000
    u++
  }
  return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)} ${units[u]}`
}

const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
const aMinute = 60_000
const anHour = 60 * aMinute
const aDay = 24 * anHour
const aMonth = 30 * aDay
const aYear = 365 * aDay

// A day or a moment, read beside what happened then, as Activity's
// timeline does: close ones in minutes or hours, far ones in days,
// months or years, never the day itself.
export const relative = (iso: unknown) => {
  if (!iso) {
    return '—'
  }
  const s = String(iso)
  const d = new Date(s.length <= 10 ? `${s}T00:00:00Z` : s)
  if (Number.isNaN(d.getTime())) {
    return s
  }
  const ms = d.getTime() - Date.now()
  const abs = Math.abs(ms)
  if (abs < aMinute) {
    return rtf.format(0, 'second')
  }
  if (abs < anHour) {
    return rtf.format(Math.round(ms / aMinute), 'minute')
  }
  if (abs < aDay) {
    return rtf.format(Math.round(ms / anHour), 'hour')
  }
  if (abs < aMonth) {
    return rtf.format(Math.round(ms / aDay), 'day')
  }
  if (abs < aYear) {
    return rtf.format(Math.round(ms / aMonth), 'month')
  }
  return rtf.format(Math.round(ms / aYear), 'year')
}

const months = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' })

// A `YYYY-MM` month, as a chart's axis reads it.
export const month = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ym : months.format(d)
}

const named = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })

// A `YYYY-MM` month in full, as a group of rows by a date's month is
// headed.
export const monthName = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? ym : named.format(d)
}

// The widest a date shows, of every month's last two-digit day, which a
// row's trailing date cell is sized to, so a short date and an empty one
// take the same width as the longest.
export const widest = Array.from({ length: 12 }, (_, m) => date(`2026-${String(m + 1).padStart(2, '0')}-28`)).reduce((a, b) => (b.length > a.length ? b : a))

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
    case 'percent':
      return percent(value)
    case 'hours':
      return hours(value)
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No'
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

// A day as a calendar's cell says it aloud: Monday 16 November 2026.
const spokenDay = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const spoken = (iso: string) => spokenDay.format(new Date(`${iso}T00:00:00Z`))

// Today in the browser's own time, as an ISO day.
export const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
