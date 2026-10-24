import type { Db } from '@cella/org-db'
import type { Posted } from '../models/posting.ts'

// Every line an expense's approval and reimbursement posted, entry by
// entry.
export async function postings(db: Db, expense: string): Promise<Posted[]> {
  const { rows } = await db.query<Posted>(
    `SELECT p.entry || '/' || l.n AS id, p.entry, p.event, to_char(e.date, 'YYYY-MM-DD') AS date, l.account, l.side,
            cella.cents(l.amount)::float8 AS cents
     FROM expense_transaction.posting p
     JOIN transaction.entry e ON e.id = p.entry
     JOIN transaction.line l ON l.entry = p.entry
     WHERE p.expense = $1 ORDER BY p.entry, l.n`,
    [expense],
  )
  return rows
}
