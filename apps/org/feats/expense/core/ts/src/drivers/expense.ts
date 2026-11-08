import { literal, numbered, type Db, type Read } from '@cella/org-db'
import { categories, type Expense } from '../models/expense.ts'

const fields = (category: string) => `e.id, e.member, to_char(e.day, 'YYYY-MM-DD') AS day, e.label, ${category} AS category,
  cella.cents(e.net)::float8 AS net, cella.cents(e.vat)::float8 AS vat, expense.total(e)::float8 AS total, e.receipt, e.status,
  to_char(e.submitted, 'YYYY-MM-DD') AS submitted, to_char(e.decided, 'YYYY-MM-DD') AS decided, e.decider,
  to_char(e.reimbursed, 'YYYY-MM-DD') AS reimbursed`
const columns = fields('e.category')

// A category as its badge shows it: its label, or its code where it has
// none.
const label = `CASE e.category ${categories.map((c) => `WHEN ${literal(c.code)} THEN ${literal(c.label)}`).join(' ')} ELSE e.category END`

// The expenses as the collection lists them, the latest spent first, each
// category by its label.
export const listing: Read = {
  sql: `SELECT ${fields(label)}, e.circle FROM expense.expense e`,
  order: `day DESC, ${numbered('id', 'DESC')}`,
}

// Every expense, the latest spent first.
export async function expenses(db: Db): Promise<Expense[]> {
  const { rows } = await db.query<Expense>(`SELECT ${columns} FROM expense.expense e ORDER BY e.day DESC, ${numbered('e.id', 'DESC')}`)
  return rows
}

export async function expense(db: Db, id: string): Promise<Expense | null> {
  const { rows } = await db.query<Expense>(`SELECT ${columns} FROM expense.expense e WHERE e.id = $1`, [id])
  return rows[0] ?? null
}
