import type { Db } from '@cella/org-db'
import type { Expense } from '../models/expense.ts'

const columns = `e.id, e.member, to_char(e.day, 'YYYY-MM-DD') AS day, e.label, e.category,
  cella.cents(e.net)::float8 AS net, cella.cents(e.vat)::float8 AS vat, expense.total(e)::float8 AS total, e.receipt, e.status,
  to_char(e.submitted, 'YYYY-MM-DD') AS submitted, to_char(e.decided, 'YYYY-MM-DD') AS decided, e.decider,
  to_char(e.reimbursed, 'YYYY-MM-DD') AS reimbursed`

// Every expense, the latest spent first.
export async function expenses(db: Db): Promise<Expense[]> {
  const { rows } = await db.query<Expense>(`SELECT ${columns} FROM expense.expense e ORDER BY e.day DESC, e.id DESC`)
  return rows
}

export async function expense(db: Db, id: string): Promise<Expense | null> {
  const { rows } = await db.query<Expense>(`SELECT ${columns} FROM expense.expense e WHERE e.id = $1`, [id])
  return rows[0] ?? null
}
