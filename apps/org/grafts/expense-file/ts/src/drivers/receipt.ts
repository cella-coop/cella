import type { Db } from '@cella/org-db'
import type { Receipt } from '../models/receipt.ts'

// How many receipts each expense holds, by the expense's id.
export async function counts(db: Db): Promise<Record<string, { receipts: number }>> {
  const { rows } = await db.query<{ expense: string; n: number }>('SELECT expense, count(*)::int AS n FROM expense_file.receipt GROUP BY expense')
  return Object.fromEntries(rows.map((r) => [r.expense, { receipts: r.n }]))
}

// The receipts attached to an expense, the first attached first.
export async function receipts(db: Db, expense: string): Promise<Receipt[]> {
  const { rows } = await db.query<Receipt>(
    `SELECT f.id, f.name, f.type, f.size, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded
     FROM expense_file.receipt r JOIN file.file f ON f.id = r.file
     WHERE r.expense = $1 ORDER BY f.id`,
    [expense],
  )
  return rows
}
