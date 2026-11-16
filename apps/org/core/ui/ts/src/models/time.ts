// A time of day as plain data: the times a time field's list offers, one
// every quarter of an hour, written on the 24-hour clock as the app's
// locale writes them (09:30, 14:00); what is typed read as one, the
// French way too (9h30); and the time a run of typed figures reaches in
// the list. Drawn by `TimeField`.

// A time as the field posts it, `HH:MM`.
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

// How a time field asks for one.
export const timePattern = 'hh:mm'

// The times a list offers, every `step` minutes from midnight.
export function times(step = 15): string[] {
  const out: string[] = []
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return out
}

// What is typed, read as a time: 9, 09, 930, 0930, 9:30, 9.30, 9h30 and
// 14h all name one; anything else, or an hour or minute past the clock,
// names none.
export function parsedTime(text: string): string | null {
  const t = text.trim().toLowerCase()
  const m = t.match(/^(\d{1,2})(?:\s*[:.h]\s*(\d{2})?)?$/) ?? t.match(/^(\d{1,2})(\d{2})$/)
  if (!m) {
    return null
  }
  const h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) {
    return null
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// Where a list opens: on the time the field holds, else the last before
// it, else `fallback`'s; the first where nothing comes before.
export function nearest(list: string[], value: string, fallback = '09:00'): number {
  const want = isTime(value) ? value : fallback
  let at = 0
  list.forEach((t, i) => {
    if (t <= want) {
      at = i
    }
  })
  return at
}

// The time a run of typed figures reaches: the first whose figures start
// with the run (14 reaches 14:00, 143 14:30), else the first whose hour,
// read without its leading nought, does (9 reaches 09:00, 93 09:30); the
// colon, a point or an h typed among them is passed over. -1 where none.
export function reached(list: string[], run: string): number {
  const typed = run.replace(/\D/g, '')
  if (!typed) {
    return -1
  }
  const figures = list.map((t) => t.replace(':', ''))
  const whole = figures.findIndex((f) => f.startsWith(typed))
  return whole >= 0 ? whole : figures.findIndex((f) => f.replace(/^0/, '').startsWith(typed))
}
