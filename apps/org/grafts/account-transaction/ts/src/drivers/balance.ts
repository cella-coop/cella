import { numbered, type Db } from '@cella/org-db'
import type { Balance, Dated, Ledger, Movement } from '../models/balance.ts'

const number = (b: Record<string, unknown>): Balance => ({ debit: Number(b.debit), credit: Number(b.credit), balance: Number(b.balance) })

// The trial balance, by account code, from `account_transaction.balance`.
export const balances = 'SELECT code AS id, debit::bigint AS debit, credit::bigint AS credit, balance::bigint AS balance FROM account_transaction.balance'

// Whether the whole journal's debits and credits agree, whatever the
// reader reads of it.
export async function agrees(db: Db): Promise<{ agrees: boolean }> {
  const { rows } = await db.query<{ agrees: boolean }>('SELECT account_transaction.agrees() AS agrees')
  return rows[0]
}

// An account's balance and every line posted to it, the latest first.
export async function ledger(db: Db, code: string): Promise<Ledger> {
  const total = await db.query('SELECT debit, credit, balance FROM account_transaction.balance WHERE code = $1', [code])
  const { rows } = await db.query<Movement>(
    `SELECT l.entry || '/' || l.n AS id, l.entry, to_char(e.date, 'YYYY-MM-DD') AS date, e.label, l.side, cella.cents(l.amount) AS cents
     FROM transaction.line l JOIN transaction.entry e ON e.id = l.entry
     WHERE l.account = $1 ORDER BY e.date DESC, ${numbered('e.id', 'DESC')}, l.n`,
    [code],
  )
  return { ...number(total.rows[0] ?? { debit: 0, credit: 0, balance: 0 }), movements: rows.map((r) => ({ ...r, cents: Number(r.cents) })) }
}

// The entries dated in a period, its month, the earliest first, each
// with what it moved; the journal's own policies keep the ones its reader
// reads.
export async function entries(db: Db, month: string): Promise<Dated[]> {
  const { rows } = await db.query<Dated>(
    `SELECT e.id, to_char(e.date, 'YYYY-MM-DD') AS date, e.label, transaction.amount(e.id) AS amount
     FROM transaction.entry e WHERE to_char(e.date, 'YYYY-MM') = $1 ORDER BY e.date, ${numbered('e.id')}`,
    [month],
  )
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}
