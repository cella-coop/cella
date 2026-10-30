import type { Db } from '@cella/org-db'
import type { Posted } from '../models/posting.ts'

// Every line a bill's approval and payment posted, entry by entry.
export async function postings(db: Db, bill: string): Promise<Posted[]> {
  const { rows } = await db.query<Posted>(
    `SELECT p.entry || '/' || l.n AS id, p.entry, p.event, to_char(e.date, 'YYYY-MM-DD') AS date, l.account, l.side,
            cella.cents(l.amount) AS cents
     FROM bill_transaction.posting p
     JOIN transaction.entry e ON e.id = p.entry
     JOIN transaction.line l ON l.entry = p.entry
     WHERE p.bill = $1 ORDER BY p.entry, l.n`,
    [bill],
  )
  return rows.map((r) => ({ ...r, cents: Number(r.cents) }))
}
