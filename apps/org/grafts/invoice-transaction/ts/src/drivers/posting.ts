import type { Db } from '@cella/org-db'
import type { Posted } from '../models/posting.ts'

// Every line an invoice's issue, payments and void posted, entry by entry.
export async function postings(db: Db, invoice: string): Promise<Posted[]> {
  const { rows } = await db.query<Posted>(
    `SELECT p.entry || '/' || l.n AS id, p.entry, p.event, to_char(e.date, 'YYYY-MM-DD') AS date, l.account, l.side,
            cella.cents(l.amount) AS cents
     FROM invoice_transaction.posting p
     JOIN transaction.entry e ON e.id = p.entry
     JOIN transaction.line l ON l.entry = p.entry
     WHERE p.invoice = $1 ORDER BY p.entry, l.n`,
    [invoice],
  )
  return rows.map((r) => ({ ...r, cents: Number(r.cents) }))
}
