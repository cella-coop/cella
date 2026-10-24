import type { Db } from '@cella/org-db'
import type { Posted } from '../models/posting.ts'

// The entries a payslip's run posted, by the payslip's id,
// `<month>~<member>`: the run's, since pay is posted run by run.
export async function postings(db: Db, id: string): Promise<Posted[]> {
  const { rows } = await db.query<Posted>(
    `SELECT p.entry AS id, p.entry, p.event, to_char(e.date, 'YYYY-MM-DD') AS date
     FROM payslip_transaction.posting p JOIN transaction.entry e ON e.id = p.entry
     WHERE p.month = $1 ORDER BY p.entry`,
    [id.split('~')[0]],
  )
  return rows
}
