import type { Db } from '@cella/org-db'
import type { Called, Payment, Repayment } from '../models/capital.ts'

// A member's capital paid in and out: their subscription and what they
// paid of it, from the bank or their pay, and, once they left, their
// repayments.
export async function called(db: Db, member: string): Promise<Called> {
  const { rows } = await db.query<{ amount: string | null; paid: string | null; unpaid: string | null; cancelled: string | null }>(
    'SELECT amount, paid, unpaid, cancelled FROM account_member_transaction.called WHERE member = $1',
    [member],
  )
  const owed = await db.query<{ amount: string; repaid: string; left: string; next: number | null }>(
    `SELECT o.amount, o.repaid, o.left,
            (SELECT min(r.n) FROM account_member_transaction.repayment r WHERE r.member = o.member AND r.paid IS NULL) AS next
     FROM account_member_transaction.owed o WHERE o.member = $1`,
    [member],
  )
  const payments = await db.query<Payment>(
    `SELECT p.entry AS id, p.entry, to_char(e.date, 'YYYY-MM-DD') AS date, cella.cents(p.amount)::float8 AS amount, p.via
     FROM account_member_transaction.paid p JOIN transaction.entry e ON e.id = p.entry
     WHERE p.member = $1 ORDER BY e.date DESC, p.entry DESC`,
    [member],
  )
  const repayments = await db.query<Repayment>(
    `SELECT r.member || '~' || r.n AS id, r.n, to_char(r.due, 'YYYY-MM-DD') AS due, cella.cents(r.amount)::float8 AS amount,
            r.entry, to_char(r.paid, 'YYYY-MM-DD') AS paid
     FROM account_member_transaction.repayment r WHERE r.member = $1 ORDER BY r.n`,
    [member],
  )
  const c = rows[0]
  const o = owed.rows[0]
  return {
    subscribed: c?.amount == null ? null : Number(c.amount),
    paid: Number(c?.paid ?? 0),
    unpaid: Math.max(Number(c?.unpaid ?? 0), 0),
    cancelled: Number(c?.cancelled ?? 0),
    owed: Number(o?.amount ?? 0),
    repaid: Number(o?.repaid ?? 0),
    left: Number(o?.left ?? 0),
    next: o?.next ?? null,
    payments: payments.rows,
    repayments: repayments.rows,
  }
}
