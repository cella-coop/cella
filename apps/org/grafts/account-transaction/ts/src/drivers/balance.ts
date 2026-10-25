import type { Db } from '@cella/org-db'
import type { Balance, Ledger, Movement } from '../models/balance.ts'

const number = (b: Record<string, unknown>): Balance => ({ debit: Number(b.debit), credit: Number(b.credit), balance: Number(b.balance) })

// The trial balance, by account code, from `account_transaction.balance`.
export async function balances(db: Db): Promise<Record<string, Balance>> {
  const { rows } = await db.query<{ code: string }>('SELECT code, debit, credit, balance FROM account_transaction.balance')
  return Object.fromEntries(rows.map((r) => [r.code, number(r)]))
}

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
     WHERE l.account = $1 ORDER BY e.date DESC, e.id DESC, l.n`,
    [code],
  )
  return { ...number(total.rows[0] ?? { debit: 0, credit: 0, balance: 0 }), movements: rows.map((r) => ({ ...r, cents: Number(r.cents) })) }
}
