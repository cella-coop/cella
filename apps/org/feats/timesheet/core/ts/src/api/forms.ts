import type { Db, Form } from '@cella/org-db'
import type { Correct, Log, Period } from '../models/timesheet.ts'

// What the shell's forms send, read into the handlers' inputs. Hours are
// typed as a decimal, a comma or a point, and sent in whole minutes; time
// is always the acting member's own.

export function minutes(typed: string): number {
  const n = Number(typed.trim().replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || n <= 0 || n > 24) {
    throw new Error(`“${typed}” is not a number of hours in a day`)
  }
  return Math.round(n * 60)
}

export const log = (form: Form, member: string): Log => ({
  member,
  day: form.get('day'),
  minutes: minutes(form.get('hours')),
  billable: form.get('billable') !== 'internal',
  note: form.get('note') || undefined,
})

// The period an entry's page acts on: its member's month in its circle.
export async function period(db: Db, entry: string | undefined): Promise<Period> {
  const { rows } = await db.query<Period>(
    'SELECT member, timesheet.month_of(day) AS month, circle FROM timesheet.entry WHERE id::text = $1',
    [entry ?? ''],
  )
  if (!rows[0]) {
    throw new Error(`no entry ${entry}`)
  }
  return rows[0]
}

// A correction from an entry's page: the hours it comes down to, none
// where the time was never worked.
export function correct(form: Form, entry: string | undefined): Correct {
  const typed = form.get('hours').trim()
  const n = Number(typed.replace(',', '.'))
  if (!entry || !typed || !Number.isFinite(n) || n < 0 || n > 24) {
    throw new Error(`“${typed}” is not a number of hours in a day`)
  }
  return { entry, minutes: Math.round(n * 60) }
}
