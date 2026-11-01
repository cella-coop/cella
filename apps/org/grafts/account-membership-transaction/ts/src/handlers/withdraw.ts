import type { Outcome } from '@cella/org-actions'
import { done, write, type Deps, type Done, type Write } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'
import type { Withdraw, Withdrawn } from '../models/capital.ts'

const op = 'account:capital:withdraw' satisfies keyof typeof actions

// An associate who left has their capital withdrawn, on the verdict date:
// what their capital accounts hold moves to 4567, owed them, what they
// had not paid of their subscription is cancelled, 1012 debited and 4562
// credited, and their repayments are drawn up as the statutes' clauses
// governing the exit say, the capital divided evenly among them to the
// cent. `account_membership_transaction.withdraws` decides: they left,
// once, and the entry and the repayments are exactly that;
// account-transaction's guard, that the month is open.
export function withdrawing(input: Withdraw): Write<Withdrawn> {
  return {
    op,
    request: input,
    state: async (tx) => {
      const held = await tx.query<{ account: string; cents: string }>(
        `SELECT a.code AS account, b.cents
         FROM account.account a
         JOIN LATERAL (
           SELECT coalesce(sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END), 0)::bigint AS cents
           FROM transaction.line l WHERE l.account = a.code
         ) b ON b.cents > 0
         WHERE a.holder = $1 AND a.parent = '1013'
         ORDER BY a.code`,
        [input.member],
      )
      const { rows } = await tx.query<{ day: string; unpaid: string | null }>(
        `SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day,
                (SELECT greatest(c.unpaid, 0) FROM account_membership_transaction.called c WHERE c.member = $1) AS unpaid`,
        [input.member],
      )
      const owed = held.rows.reduce((sum, r) => sum + Number(r.cents), 0)
      const cancelled = Number(rows[0].unpaid ?? 0)
      const lines: Line[] = [
        ...held.rows.map((r) => ({ account: r.account, side: 'debit' as const, cents: Number(r.cents) })),
        ...(owed > 0 ? [{ account: '4567', side: 'credit' as const, cents: owed }] : []),
        ...(cancelled > 0
          ? [
              { account: '1012', side: 'debit' as const, cents: cancelled },
              { account: '4562', side: 'credit' as const, cents: cancelled },
            ]
          : []),
      ]
      if (!lines.length) {
        throw new Error(`${input.member} holds and owes no capital to withdraw`)
      }
      const { entry } = await record(tx, { date: rows[0].day, label: `Capital to repay, ${input.member}`, lines })
      if (cancelled > 0) {
        await tx.query('UPDATE account_membership_transaction.subscription SET cancelled = cella.amount($2) WHERE member = $1', [input.member, cancelled])
      }
      const drawn = owed > 0
        ? await tx.query(
            `INSERT INTO account_membership_transaction.repayment (member, n, due, amount)
             SELECT $1, r.n, r.due, cella.amount((cella.allocate(cella.amount($2), array_fill(1::bigint, ARRAY[t.repayments])))[r.n])
             FROM account.repayments(account.capital_for(cella.verdict_date()), cella.verdict_date()) r
             CROSS JOIN account.terms t WHERE t.id = account.capital_for(cella.verdict_date())`,
            [input.member, owed],
          )
        : { rowCount: 0 }
      await tx.query('INSERT INTO account_membership_transaction.withdrawal (member, entry) VALUES ($1, $2)', [input.member, entry])
      return { member: input.member, owed, cancelled, repayments: drawn.rowCount ?? 0, entry }
    },
    payload: (v) => ({ ...v, motion: input.motion }),
  }
}

export async function withdraw(input: Withdraw, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Withdrawn>> {
  return write(deps, withdrawing(input))
}

// What follows an exit: the associate's capital withdrawn, a write of its
// own signed by whoever signed the exit and citing the motion that ended
// the membership. Where no terms govern the exit, or they hold and owe
// nothing, nothing is drawn up and no write is made: their capital stays
// frozen where it is.
export async function withdrawn(request: unknown, deps: Deps): Promise<Done[]> {
  const { member, motion } = request as { member: string; motion: string }
  const { rows } = await deps.db.query<{ any: boolean }>('SELECT account_membership_transaction.holds($1) AS any', [member])
  if (!rows[0]?.any) {
    return []
  }
  const input = { member, motion }
  return [done(op, await withdraw(input, deps), [], input)]
}
