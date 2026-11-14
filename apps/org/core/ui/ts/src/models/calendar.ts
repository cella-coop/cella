import type { Field } from './query.ts'

// A calendar's period: a month, as weeks from the Monday on or before its
// first day to the Sunday on or after its last, or a week, Monday to
// Sunday. Days are ISO days, computed in UTC, so the server and the
// browser draw the same grid.

export const spans = ['month', 'week'] as const
export type Span = (typeof spans)[number]

export interface Day {
  day: string
  // Whether the day is in the month shown, not one of the weeks' edges.
  inside: boolean
  today: boolean
}

export interface Period {
  span: Span
  label: string
  days: Day[]
  // The days the arrows go to.
  prev: string
  next: string
}

const iso = /^\d{4}-\d{2}-\d{2}$/

// The day a calendar shows, from the address: an ISO day, else today.
export const anchor = (raw: string | null, today: string) => (raw && iso.test(raw) && !Number.isNaN(utc(raw).getTime()) ? raw : today)

const utc = (day: string) => new Date(`${day}T00:00:00Z`)
const day = (d: Date) => d.toISOString().slice(0, 10)
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
// The Monday on or before a day.
const monday = (d: Date) => plus(d, -((d.getUTCDay() + 6) % 7))

const months = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const short = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const long = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function period(at: string, span: Span, today: string): Period {
  const d = utc(at)
  if (span === 'week') {
    const start = monday(d)
    const days = Array.from({ length: 7 }, (_, i) => day(plus(start, i)))
    return {
      span,
      label: `${short.format(start)} – ${long.format(plus(start, 6))}`,
      days: days.map((x) => ({ day: x, inside: true, today: x === today })),
      prev: day(plus(start, -7)),
      next: day(plus(start, 7)),
    }
  }
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  const start = monday(first)
  const end = plus(monday(last), 6)
  const days: Day[] = []
  for (let x = start; x <= end; x = plus(x, 1)) {
    days.push({ day: day(x), inside: x.getUTCMonth() === first.getUTCMonth(), today: day(x) === today })
  }
  return {
    span,
    label: months.format(first),
    days,
    prev: day(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1))),
    next: day(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1))),
  }
}

// The rows on each day of a period, by the date field a calendar places
// them by, in the order of their time when the field holds one
// (`YYYY-MM-DDTHH:MM`), or as they came where the view `sorted` them;
// a row with no date is on no day.
export function placed(rows: any[], on: Field, p: Period, sorted = false): Map<string, any[]> {
  const out = new Map<string, any[]>(p.days.map((d) => [d.day, []]))
  for (const r of rows) {
    const v = on.value(r)
    out.get(v ? String(v).slice(0, 10) : '')?.push(r)
  }
  for (const list of sorted ? [] : out.values()) {
    list.sort((a, b) => String(on.value(a)).localeCompare(String(on.value(b))))
  }
  return out
}

// A row's time of day on the calendar, if its date holds one.
export const time = (v: unknown) => {
  const s = String(v ?? '')
  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) ? s.slice(11, 16) : ''
}
