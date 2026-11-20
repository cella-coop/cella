import { today, type Db } from '@cella/org-db'
import { offering } from '@cella/org-circle/models'
import { sitting } from '@cella/org-circle/api'
import type { Time } from '../models/booking.ts'

// Each entry's project, by entry, which the timesheets group by, and
// its id, by which the project's page jumps to its time.
export const projectOf = 'SELECT b.entry::text AS id, p.title AS project, b.project AS project_id FROM project_timesheet.booking b JOIN project.project p ON p.id = b.project'

// What each project's time spent of its budget, by project, nothing where
// it has no time.
export const burns = `SELECT p.id, coalesce(b.hours, 0) AS hours, coalesce(b.spent, 0) AS used
  FROM project.project p LEFT JOIN project_timesheet.burn b ON b.project = p.id`

// A project's time, by member and its latest entries, and the circles
// the acting member may log time on it for today: those they sit in, the
// project's first where they sit in it.
export async function time(db: Db, project: string, actor: string | null = null): Promise<Time> {
  const { rows } = await db.query<{ hours: string; billable: string; spent: string }>(
    'SELECT hours, billable, spent FROM project_timesheet.burn WHERE project = $1',
    [project],
  )
  const { rows: members } = await db.query<Time['members'][number]>(
    `SELECT member AS id, member, sum(hours)::float8 AS hours, coalesce(sum(hours) FILTER (WHERE billable), 0)::float8 AS billable
     FROM project_timesheet.costed WHERE project = $1 GROUP BY member ORDER BY sum(hours) DESC, member`,
    [project],
  )
  const { rows: entries } = await db.query<Time['entries'][number]>(
    `SELECT entry::text AS id, member, to_char(day, 'YYYY-MM-DD') AS day, hours::float8 AS hours, billable
     FROM project_timesheet.costed WHERE project = $1 ORDER BY day DESC, entry DESC LIMIT 20`,
    [project],
  )
  const { rows: rate } = await db.query<{ hourly: string | null; archived: boolean; circle: string | null }>(
    `SELECT (SELECT cella.cents(hourly) FROM project_timesheet.rate ORDER BY since DESC LIMIT 1) AS hourly,
            (SELECT archived IS NOT NULL FROM project.project WHERE id = $1) AS archived,
            (SELECT circle FROM project.project WHERE id = $1) AS circle`,
    [project],
  )
  const r = rows[0]
  const day = await today(db)
  return {
    hours: Number(r?.hours ?? 0),
    billable: Number(r?.billable ?? 0),
    spent: Number(r?.spent ?? 0),
    hourly: rate[0]?.hourly ? Number(rate[0].hourly) : null,
    members,
    entries,
    today: day,
    archived: rate[0]?.archived ?? true,
    circles: actor ? offering(await sitting(db, actor, day, day), rate[0]?.circle ?? null) : [],
  }
}
