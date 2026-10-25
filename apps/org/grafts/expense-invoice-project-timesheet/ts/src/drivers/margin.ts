import type { Db } from '@cella/org-db'
import type { Margin } from '../models/margin.ts'

const figures = ['invoiced', 'cost', 'expenses', 'margin', 'percent', 'budget', 'spent', 'burn', 'forecast', 'landing'] as const

const margin = (r: Record<string, unknown>): Margin => ({
  ...(Object.fromEntries(figures.map((k) => [k, r[k] === null ? null : Number(r[k])])) as Omit<Margin, 'watch'>),
  watch: (r.watch as Margin['watch']) ?? null,
})

// Each project's margin today, by project, from
// `expense_invoice_project_timesheet.margin`.
export async function margins(db: Db, day = new Date().toISOString().slice(0, 10)): Promise<Record<string, Margin>> {
  const { rows } = await db.query<{ project: string }>('SELECT * FROM expense_invoice_project_timesheet.margin($1)', [day])
  return Object.fromEntries(rows.map((r) => [r.project, margin(r)]))
}

// One project's margin today.
export async function marginOf(db: Db, project: string, day = new Date().toISOString().slice(0, 10)): Promise<Margin | null> {
  const { rows } = await db.query('SELECT * FROM expense_invoice_project_timesheet.margin($1) WHERE project = $2', [day, project])
  return rows[0] ? margin(rows[0]) : null
}
