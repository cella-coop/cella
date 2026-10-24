import type { Db } from '@cella/org-db'
import type { Burn, Time } from '../models/booking.ts'

// Each entry's project, by entry, which the dashboard groups hours by.
export async function projectOf(db: Db): Promise<Record<string, { project: string }>> {
  const { rows } = await db.query<{ entry: string; title: string }>(
    'SELECT b.entry::text AS entry, p.title FROM project_timesheet.booking b JOIN project.project p ON p.id = b.project',
  )
  return Object.fromEntries(rows.map((r) => [r.entry, { project: r.title }]))
}

// What each project's time spent of its budget, by project.
export async function burns(db: Db): Promise<Record<string, Burn>> {
  const { rows } = await db.query<{ project: string; hours: string; spent: string }>('SELECT project, hours, spent FROM project_timesheet.burn')
  return Object.fromEntries(rows.map((r) => [r.project, { hours: Number(r.hours), used: Number(r.spent) }]))
}

// A project's time, by member and its latest entries.
export async function time(db: Db, project: string): Promise<Time> {
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
  const { rows: rate } = await db.query<{ hourly: string | null; archived: boolean }>(
    `SELECT (SELECT cella.cents(hourly) FROM project_timesheet.rate ORDER BY since DESC LIMIT 1) AS hourly,
            (SELECT archived IS NOT NULL FROM project.project WHERE id = $1) AS archived`,
    [project],
  )
  const r = rows[0]
  return {
    hours: Number(r?.hours ?? 0),
    billable: Number(r?.billable ?? 0),
    spent: Number(r?.spent ?? 0),
    hourly: rate[0]?.hourly ? Number(rate[0].hourly) : null,
    members,
    entries,
    today: new Date().toISOString().slice(0, 10),
    archived: rate[0]?.archived ?? true,
  }
}
