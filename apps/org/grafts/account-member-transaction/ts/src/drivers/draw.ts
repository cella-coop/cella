import type { Db } from '@cella/org-db'
import type { Account, Drawing } from '../models/draw.ts'

// A member's account on their page: their draws and what is left of their
// limit, their capital's balance in the books and the entry that
// subscribed it, and whether `actor` is that member.
export async function account(db: Db, member: string, actor: string | null): Promise<Account> {
  const { rows } = await db.query<{ account: string | null; frozen: boolean; allowance: string | null; drawn: string; balance: string; subscribed: string | null }>(
    `SELECT w.account, w.frozen, w.allowance, w.drawn,
            coalesce((SELECT sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END)
                      FROM transaction.line l WHERE l.account = w.account), 0) AS balance,
            s.entry AS subscribed
     FROM account_member_transaction.drawn w
     LEFT JOIN account_member_transaction.subscription s ON s.member = w.member
     WHERE w.member = $1`,
    [member],
  )
  const draws = await db.query<Drawing>(
    `SELECT d.entry AS id, d.entry, to_char(e.date, 'YYYY-MM-DD') AS date, cella.cents(d.amount)::float8 AS amount
     FROM account_member_transaction.draw d JOIN transaction.entry e ON e.id = d.entry
     WHERE d.member = $1 ORDER BY e.date DESC, d.entry DESC`,
    [member],
  )
  const a = rows[0]
  return {
    account: a?.account ?? null,
    frozen: a?.frozen ?? false,
    allowance: a?.allowance == null ? null : Number(a.allowance),
    drawn: Number(a?.drawn ?? 0),
    balance: Number(a?.balance ?? 0),
    subscribed: a?.subscribed ?? null,
    own: actor === member,
    draws: draws.rows,
  }
}
