import type { Db } from '@cella/org-db'
import type { Detail, Issuing, Lined, Listed, Printed, Received, Seller, Taxed } from '../models/invoice.ts'

// An invoice is overdue when something is owed past its due date, by the
// server's clock: a read, so no rule depends on it.
const listed = `i.id, to_char(i.issued, 'YYYY-MM-DD') AS issued, to_char(i.due, 'YYYY-MM-DD') AS due, i.bill_to, i.label,
  s.total::bigint AS total, s.paid::bigint AS paid, s.owed::bigint AS owed, s.credit::bigint AS credit, s.state,
  (s.owed > 0 AND i.due < current_date) AS overdue,
  to_char(i.sent, 'YYYY-MM-DD') AS sent, to_char(i.voided, 'YYYY-MM-DD') AS voided`

// Postgres sends bigints as text; amounts are read back as numbers.
const cents = <T extends object>(row: T, keys: (keyof T)[]): T =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, keys.includes(k as keyof T) && v !== null ? Number(v) : v])) as T

const money: (keyof Listed)[] = ['total', 'paid', 'owed', 'credit']

// The latest first.
export async function invoices(db: Db): Promise<Listed[]> {
  const { rows } = await db.query<Listed>(`SELECT ${listed} FROM invoice.invoice i JOIN invoice.standing s ON s.id = i.id ORDER BY i.series DESC, i.number DESC`)
  return rows.map((r) => cents(r, money))
}

export async function invoice(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Detail>(
    `SELECT ${listed}, i.series, i.number, i.bill_address, cella.cents(i.net) AS net, cella.cents(i.vat) AS vat, i.reason
     FROM invoice.invoice i JOIN invoice.standing s ON s.id = i.id WHERE i.id = $1`,
    [id],
  )
  if (!found.rows[0]) {
    return null
  }
  const lines = await db.query<Lined>(
    `SELECT n::text AS id, n, description, quantity::text AS quantity, cella.cents(unit_price) AS unit_price,
            cella.cents(amount) AS amount, vat_rate::text AS vat_rate
     FROM invoice.line WHERE invoice = $1 ORDER BY n`,
    [id],
  )
  const payments = await db.query<Received>(
    `SELECT id::text AS id, receipt::int AS receipt, to_char(at, 'YYYY-MM-DD') AS at, cella.cents(amount) AS amount, method, reference
     FROM invoice.payment WHERE invoice = $1 ORDER BY at, id`,
    [id],
  )
  return {
    ...cents(found.rows[0], [...money, 'net', 'vat']),
    lines: lines.rows.map((l) => cents(l, ['unit_price', 'amount'])),
    payments: payments.rows.map((p) => cents(p, ['amount'])),
  }
}

export async function offered(db: Db): Promise<Issuing> {
  const series = await db.query<{ name: string; next: number }>('SELECT name, next FROM invoice.series ORDER BY name DESC')
  const billed = await db.query<{ bill_to: string }>('SELECT DISTINCT bill_to FROM invoice.invoice ORDER BY bill_to')
  return { series: series.rows, billed: billed.rows.map((r) => r.bill_to) }
}

// What an invoice's PDF prints: the invoice, its VAT by rate from
// `invoice.taxed`, and the seller from the scope's settings.
export async function printed(db: Db, id: string): Promise<Printed | null> {
  const found = await invoice(db, id)
  if (!found) {
    return null
  }
  const taxed = await db.query<Taxed>(
    'SELECT rate::text AS rate, base::bigint AS base, tax::bigint AS tax FROM invoice.taxed WHERE invoice = $1 ORDER BY rate',
    [id],
  )
  const seller = await db.query<Seller>(
    `SELECT nullif(current_setting('cella.scope_legal_name', true), '') AS name,
            nullif(current_setting('cella.scope_form', true), '') AS form,
            nullif(current_setting('cella.scope_capital', true), '') AS capital,
            nullif(current_setting('cella.scope_siren', true), '') AS siren,
            nullif(current_setting('cella.scope_rcs', true), '') AS rcs,
            nullif(current_setting('cella.scope_vat', true), '') AS vat,
            nullif(current_setting('cella.scope_seat', true), '') AS seat`,
  )
  return { invoice: found, taxed: taxed.rows.map((t) => cents(t, ['base', 'tax'])), seller: seller.rows[0] }
}
