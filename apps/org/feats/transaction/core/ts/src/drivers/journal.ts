import type { Db } from '@cella/org-db'
import type { Booked, Detail, Journaled } from '../models/transaction.ts'

const listed = `e.id, to_char(e.date, 'YYYY-MM-DD') AS date, e.label, e.corrects, e.receipt::int AS receipt,
  transaction.amount(e.id) AS amount`

// The journal, the latest entry first.
export async function journal(db: Db): Promise<Journaled[]> {
  const { rows } = await db.query<Journaled>(`SELECT ${listed} FROM transaction.entry e ORDER BY e.id DESC`)
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}

// An entry, its lines and the entries that correct it.
export async function entry(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Journaled>(`SELECT ${listed} FROM transaction.entry e WHERE e.id = $1`, [id])
  if (!found.rows[0]) {
    return null
  }
  const lines = await db.query<Booked>(
    `SELECT n::text AS id, n, account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n`,
    [id],
  )
  const corrected = await db.query<{ id: string }>('SELECT id FROM transaction.entry WHERE corrects = $1 ORDER BY id', [id])
  return {
    ...found.rows[0],
    amount: Number(found.rows[0].amount),
    lines: lines.rows.map((l) => ({ ...l, cents: Number(l.cents) })),
    corrected: corrected.rows.map((r) => r.id),
  }
}
