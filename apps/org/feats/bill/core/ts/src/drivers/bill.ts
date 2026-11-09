import { literal, today, type Db, type Read } from '@cella/org-db'
import { categories, type Detail, type Lined, type Listed, type Recording, type Taxed } from '../models/bill.ts'

// A bill is overdue when it is not paid past its due date, the scope's
// day (`cella.verdict_date()`): a read, so no guard depends on it.
const standing = `CASE WHEN b.status <> 'paid' AND b.due < cella.verdict_date() THEN 'overdue' ELSE b.status END`
const fields = (category: string) => `b.id, b.supplier, b.reference, to_char(b.issued, 'YYYY-MM-DD') AS issued,
  to_char(b.due, 'YYYY-MM-DD') AS due, b.label, ${category} AS category,
  cella.cents(b.net)::float8 AS net, cella.cents(b.vat)::float8 AS vat, cella.cents(b.total)::float8 AS total,
  b.status, ${standing} AS standing, to_char(b.recorded, 'YYYY-MM-DD') AS recorded, b.recorder,
  to_char(b.approved, 'YYYY-MM-DD') AS approved, b.approver, to_char(b.paid, 'YYYY-MM-DD') AS paid`
const columns = fields('b.category')

// A category as its badge shows it: its label, or its code where it has
// none.
const label = `CASE b.category ${categories.map((c) => `WHEN ${literal(c.code)} THEN ${literal(c.label)}`).join(' ')} ELSE b.category END`

// The bills as the collection lists them, the latest recorded first, each
// category by its label.
export const listing: Read = {
  sql: `SELECT ${fields(label)}, b.circle FROM bill.bill b`,
  order: 'recorded DESC, id DESC',
}

// Every bill, the latest recorded first.
export async function bills(db: Db): Promise<Listed[]> {
  const { rows } = await db.query<Listed>(`SELECT ${columns} FROM bill.bill b ORDER BY b.recorded DESC, b.id DESC`)
  return rows
}

// A bill with its lines and its VAT by rate.
export async function bill(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Listed>(`SELECT ${columns} FROM bill.bill b WHERE b.id = $1`, [id])
  if (!found.rows[0]) {
    return null
  }
  const lines = await db.query<Lined>(
    `SELECT n::text AS id, n, description, quantity::text AS quantity, cella.cents(unit_price)::float8 AS unit_price,
            cella.cents(amount)::float8 AS amount, vat_rate::text AS vat_rate
     FROM bill.line WHERE bill = $1 ORDER BY n`,
    [id],
  )
  const taxed = await db.query<Taxed>(
    'SELECT rate::text AS rate, base::float8 AS base, tax::float8 AS tax FROM bill.taxed t WHERE t.bill = $1 ORDER BY t.rate',
    [id],
  )
  return { ...found.rows[0], lines: lines.rows, taxed: taxed.rows }
}

export async function offered(db: Db): Promise<Recording> {
  const { rows } = await db.query<{ supplier: string }>('SELECT DISTINCT supplier FROM bill.bill ORDER BY supplier')
  return { suppliers: rows.map((r) => r.supplier), today: await today(db) }
}
