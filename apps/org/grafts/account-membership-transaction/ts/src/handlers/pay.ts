import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry, Line } from '@cella/org-transaction/models'
import type { Paid, Pay } from '../models/capital.ts'

const op = 'account:capital:pay' satisfies keyof typeof actions

// An associate pays in on their subscription from the bank: 512 debited
// and 4562 credited, and what it pays moved from 1012 to their capital
// account, on the verdict date. `account_membership_transaction.pays`
// decides: never more than they owe, and nothing else in the entry.
export async function pay(input: Pay, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Paid>> {
  // The entry it posts, which its payload keeps for its fold.
  let posting: Entry | null = null
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ day: string; account: string | null }>(
        `SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day,
                (SELECT c.account FROM account_membership_transaction.called c WHERE c.member = $1) AS account`,
        [input.member],
      )
      const { day, account } = rows[0]
      if (!account) {
        return { member: input.member, amount: input.cents, entry: '' }
      }
      const lines = await tx.query<{ account: string; side: Line['side']; cents: string }>(
        'SELECT account, side, cents FROM account_membership_transaction.paying($1, $2)',
        [account, input.cents],
      )
      posting = {
        date: day,
        label: 'Capital paid in',
        lines: lines.rows.map((l) => ({ account: l.account, side: l.side, cents: Number(l.cents) })),
      }
      const { entry } = await record(tx, posting)
      await tx.query(
        `INSERT INTO account_membership_transaction.paid (entry, member, amount, via) VALUES ($1, $2, cella.amount($3), 'bank')`,
        [entry, input.member, input.cents],
      )
      return { member: input.member, amount: input.cents, entry }
    },
    // The amount is the member's capital: the log keeps its commitment.
    payload: (v) => ({ ...v, amount: personal('account_membership_transaction.paid.amount', v.member, v.amount), ...(posting ? { posting: logged(posting) } : {}) }),
  })
}
