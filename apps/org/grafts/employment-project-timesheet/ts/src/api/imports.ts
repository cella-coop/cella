import { csv, type Db, type Imported, type Importer } from '@cella/org-db'
import { log } from '@cella/org-graft-employment-timesheet/api'
import { book } from '../handlers/book.ts'
import { hours } from '../models/week.ts'

// One worked stretch of a time tracker's export, read: whose, by the
// address or the name the export gives; the day, the minutes, the
// project's title, whether billable, and the note.
interface Stretch {
  line: number
  email: string
  name: string
  day: string
  minutes: number
  project: string
  billable: boolean
  note: string
}

const yes = (typed: string | undefined) => /^(yes|true|oui|1)$/i.test((typed ?? '').trim())

// Each stretch booked as its worker's own time, as the importing member:
// to the project the co-op holds under its title, or the co-op's own time
// when it names none. A stretch of anyone but the importing member is
// refused, as their own grid would refuse it: each worker imports their
// own export. A line is labelled by its day, its project and its hours.
async function booked(stretches: Stretch[], db: Db): Promise<Imported[]> {
  const { rows: projects } = await db.query<{ id: string; title: string }>('SELECT id, title FROM project.project WHERE archived IS NULL')
  const { rows: workers } = await db.query<{ address: string; name: string | null }>('SELECT w.address, p.name FROM employment.worker w JOIN person.person p ON p.address = w.address')
  const titled = new Map(projects.map((p) => [p.title.trim().toLowerCase(), p]))
  return stretches.map((s) => {
    const p = titled.get(s.project.trim().toLowerCase())
    const label = `${s.day}, ${s.project ? (p?.title ?? s.project) : 'the co-op'}, ${hours(s.minutes)} h`
    const op = s.project ? 'employment-project-timesheet:entry:book' : 'employment-timesheet:entry:log'
    const worker =
      workers.find((w) => w.address === s.email.toLowerCase()) ?? workers.find((w) => s.name && w.name?.trim().toLowerCase() === s.name.trim().toLowerCase())
    if (!worker) {
      return { line: s.line, label, op, refused: 'whose time it is names no worker of the co-op' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.day) || !(s.minutes > 0)) {
      return { line: s.line, label, op, refused: 'its day or its duration cannot be read' }
    }
    if (s.project && !p) {
      return { line: s.line, label, op, refused: `the co-op has no project titled ${s.project}` }
    }
    const entry = { member: worker.address, day: s.day, minutes: s.minutes, billable: s.billable, note: s.note || undefined }
    return { line: s.line, label, op, run: (deps) => (p ? book({ ...entry, project: p.id }, deps) : log(entry, deps)) }
  })
}

// Toggl Track's detailed report, exported as CSV: `Email` (or `User`),
// `Project`, `Description`, `Billable`, `Start date` and `Duration` as
// HH:MM:SS.
export const toggl: Importer = {
  title: 'Time from Toggl',
  formats: 'Toggl Track’s detailed report as CSV: User, Email, Project, Description, Billable, Start date, Duration',
  read: (text, db) => {
    const rows = csv(text)
    if (rows.length && !('Start date' in rows[0].fields && 'Duration' in rows[0].fields)) {
      throw new Error('this is no Toggl export: its header lacks Start date and Duration')
    }
    return booked(
      rows.map(({ line, fields }) => {
        const [h, m, s] = (fields.Duration ?? '').split(':').map(Number)
        return {
          line,
          email: fields.Email ?? '',
          name: fields.User ?? '',
          day: fields['Start date'] ?? '',
          minutes: Math.round(h * 60 + m + (s || 0) / 60),
          project: fields.Project ?? '',
          billable: yes(fields.Billable),
          note: fields.Description ?? '',
        }
      }),
      db,
    )
  },
}

// Harvest's detailed time report, exported as CSV: `Date`, `Project`,
// `Notes`, `Hours` as a decimal, `Billable?`, and `First Name` and `Last
// Name`, matched against the workers' names, since it gives no address.
export const harvest: Importer = {
  title: 'Time from Harvest',
  formats: 'Harvest’s detailed time report as CSV: Date, Project, Notes, Hours, Billable?, First Name, Last Name',
  read: (text, db) => {
    const rows = csv(text)
    if (rows.length && !('Date' in rows[0].fields && 'Hours' in rows[0].fields)) {
      throw new Error('this is no Harvest export: its header lacks Date and Hours')
    }
    return booked(
      rows.map(({ line, fields }) => ({
        line,
        email: '',
        name: [fields['First Name'], fields['Last Name']].filter(Boolean).join(' '),
        day: fields.Date ?? '',
        minutes: Math.round(Number((fields.Hours ?? '').replace(',', '.')) * 60),
        project: fields.Project ?? '',
        billable: yes(fields['Billable?']),
        note: fields.Notes ?? '',
      })),
      db,
    )
  },
}
