import type { Db } from '@cella/org-db'
import type { Week } from '../models/week.ts'

const iso = (d: Date) => d.toISOString().slice(0, 10)

// The Monday of a day's week.
export function monday(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return iso(d)
}

const plus = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

// A worker's week from its Monday, as the grid enters it, or null for
// someone the co-op does not employ: its days, open once they have come
// while the worker is employed; the projects not archived, those they
// booked to in the four weeks before first; the co-op's own time; and
// what is logged in each.
export async function week(db: Db, worker: string | null, from: string, today: string): Promise<Week | null> {
  if (!worker || !(await db.query('SELECT FROM worker.worker WHERE address = $1', [worker])).rowCount) {
    return null
  }
  const sunday = plus(from, 6)
  const days = await db.query<{ day: string; open: boolean }>(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, d <= $3::date AND worker.employed($1, d::date) AS open
     FROM generate_series($2::date, $2::date + 6, interval '1 day') AS d ORDER BY d`,
    [worker, from, today],
  )
  const projects = await db.query<{ project: string; title: string }>(
    `SELECT p.id AS project, p.title
     FROM project.project p
     LEFT JOIN LATERAL (
       SELECT max(e.day) AS last FROM project_timesheet.booking b JOIN timesheet.entry e ON e.id = b.entry
       WHERE b.project = p.id AND e.member = $1 AND e.day >= $2::date - 28
     ) u ON true
     WHERE p.archived IS NULL AND p.started <= $3::date
     ORDER BY u.last DESC NULLS LAST, p.title`,
    [worker, from, sunday],
  )
  const logged = await db.query<{ project: string; day: string; minutes: number }>(
    `SELECT coalesce(b.project, '') AS project, to_char(e.day, 'YYYY-MM-DD') AS day, sum(e.minutes)::int AS minutes
     FROM timesheet.entry e LEFT JOIN project_timesheet.booking b ON b.entry = e.id
     WHERE e.member = $1 AND e.day BETWEEN $2::date AND $3::date
     GROUP BY 1, 2`,
    [worker, from, sunday],
  )
  const cells: Week['logged'] = {}
  for (const l of logged.rows) {
    cells[l.project] = { ...cells[l.project], [l.day]: l.minutes }
  }
  return {
    worker,
    monday: from,
    days: days.rows,
    rows: [...projects.rows, { project: '', title: 'The co-op’s own time' }],
    logged: cells,
  }
}

// The weeks the grid offers the acting worker: this one and the one
// before, for the Monday that closes last week's, today being the
// notary's.
export async function weeks(db: Db, worker: string | null): Promise<Week[]> {
  const { rows } = await db.query<{ today: string }>(`SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS today`)
  const today = rows[0].today
  const now = monday(today)
  const shown = [await week(db, worker, now, today), await week(db, worker, plus(now, -7), today)]
  return shown.filter((w): w is Week => w !== null)
}
