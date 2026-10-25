import type { Db } from '@cella/org-db'
import type { Filed, Spent } from '../models/rebill.ts'

// Each expense's project, by the expense's id: the co-op where it is billed
// on to none.
export const projects = `SELECT e.id, coalesce(p.title, 'the co-op') AS project
  FROM expense.expense e LEFT JOIN (expense_project.rebill r JOIN project.project p ON p.id = r.project) ON r.expense = e.id`

export async function filed(db: Db, expense: string): Promise<Filed> {
  const { rows } = await db.query<{ project: string; title: string }>(
    'SELECT r.project, p.title FROM expense_project.rebill r JOIN project.project p ON p.id = r.project WHERE r.expense = $1',
    [expense],
  )
  const live = await db.query<{ id: string; title: string }>('SELECT id, title FROM project.project WHERE archived IS NULL ORDER BY title')
  return { project: rows[0]?.project ?? null, title: rows[0]?.title ?? null, projects: live.rows }
}

// What a project's members spent for it.
export async function spent(db: Db, project: string): Promise<Spent> {
  const total = await db.query<{ approved: string; pending: string }>('SELECT approved, pending FROM expense_project.spent WHERE project = $1', [project])
  const { rows } = await db.query<Spent['expenses'][number]>(
    `SELECT e.id, e.label, to_char(e.day, 'YYYY-MM-DD') AS day, expense.total(e)::float8 AS total, e.status
     FROM expense_project.rebill r JOIN expense.expense e ON e.id = r.expense
     WHERE r.project = $1 ORDER BY e.day DESC`,
    [project],
  )
  return { approved: Number(total.rows[0]?.approved ?? 0), pending: Number(total.rows[0]?.pending ?? 0), expenses: rows }
}
