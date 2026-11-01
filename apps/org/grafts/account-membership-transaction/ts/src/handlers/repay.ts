import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import { record } from '@cella/org-transaction/api'
import type { Repaid, Repay } from '../models/capital.ts'

const op = 'account:capital:repay' satisfies keyof typeof actions

// Repays a departed associate's capital, one repayment: the bank pays
// what it says, 4567 debited and 512 credited, on the verdict date, and
// the repayment is paid. `account_membership_transaction.repays` decides: it
// has fallen due, every one before it is paid, and it is paid once.
export async function repay(input: Repay, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Repaid>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ day: string; cents: string | null }>(
        `SELECT to_char(cella.verdict_date(), 'YYYY-MM-DD') AS day,
                (SELECT cella.cents(r.amount) FROM account_membership_transaction.repayment r
                 WHERE r.member = $1 AND r.n = $2 AND r.paid IS NULL) AS cents`,
        [input.member, input.n],
      )
      const { day, cents } = rows[0]
      if (cents === null) {
        return { ...input, amount: 0, entry: null }
      }
      const { entry } = await record(tx, {
        date: day,
        label: `Capital repaid, ${input.n}`,
        lines: [
          { account: '4567', side: 'debit', cents: Number(cents) },
          { account: '512', side: 'credit', cents: Number(cents) },
        ],
      })
      await tx.query(
        'UPDATE account_membership_transaction.repayment SET entry = $3, paid = cella.verdict_date() WHERE member = $1 AND n = $2',
        [input.member, input.n, entry],
      )
      return { ...input, amount: Number(cents), entry }
    },
    payload: (v) => ({ ...v }),
  })
}
