import type { Db } from '@cella/org-db'
import type { Margin } from '../models/margin.ts'

const figures = ['invoiced', 'cost', 'expenses', 'margin', 'percent', 'budget', 'spent', 'burn', 'forecast', 'landing'] as const

const margin = (r: Record<string, unknown>): Margin => ({
  ...(Object.fromEntries(figures.map((k) => [k, r[k] === null ? null : Number(r[k])])) as Omit<Margin, 'watch'>),
  watch: (r.watch as Margin['watch']) ?? null,
})

// Each project's margin on the scope's day as the projects list it, from
// `expense_invoice_project_timesheet.margin`, its watch as its badge shows
// it: `archived` once it is.
export const listing = `SELECT project AS id, invoiced, cost, expenses, margin, percent, budget, spent, burn, forecast, landing,
    coalesce(watch, 'archived') AS watch
  FROM expense_invoice_project_timesheet.margin(cella.verdict_date())`

// How many projects are watched on the scope's day.
export async function watched(db: Db): Promise<{ watched: number }> {
  const { rows } = await db.query<{ watched: number }>(
    `SELECT count(*)::int AS watched FROM expense_invoice_project_timesheet.margin(cella.verdict_date()) WHERE watch <> 'on track'`,
  )
  return { watched: rows[0]?.watched ?? 0 }
}

// Each project's margin on a day, the scope's unless named, by project,
// from `expense_invoice_project_timesheet.margin`.
export async function margins(db: Db, day?: string): Promise<Record<string, Margin>> {
  const { rows } = await db.query<{ project: string }>('SELECT * FROM expense_invoice_project_timesheet.margin(coalesce($1::date, cella.verdict_date()))', [day ?? null])
  return Object.fromEntries(rows.map((r) => [r.project, margin(r)]))
}

// One project's margin on a day, the scope's unless named.
export async function marginOf(db: Db, project: string, day?: string): Promise<Margin | null> {
  const { rows } = await db.query('SELECT * FROM expense_invoice_project_timesheet.margin(coalesce($1::date, cella.verdict_date())) WHERE project = $2', [day ?? null, project])
  return rows[0] ? margin(rows[0]) : null
}
