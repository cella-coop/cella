import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '@cella/org-account/models'
import type { Spread, Spreading } from '../models/plan.ts'

const op = 'account:capital:spread' satisfies keyof typeof actions

// An associate spreads what they owe on their subscription over monthly
// instalments from their pay, each what is owed divided by them, rounded
// up to the cent, from the verdict date on; spreading again replaces the
// plan, which counts the instalments their pay withheld before it.
// `account_membership_payslip_transaction.spreads` decides: their own,
// something owed, and no more instalments than the statutes allow less
// those withheld already. Each run's payment then withholds an
// instalment, in its own write, until the plan's count is withheld.
export async function spread(input: Spread, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Spreading>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ each: string | null }>(
        `SELECT (c.unpaid + $2 - 1) / $2 AS each FROM account_membership_transaction.called c WHERE c.member = $1 AND c.unpaid > 0`,
        [input.member, input.instalments],
      )
      const each = rows[0]?.each == null ? null : Number(rows[0].each)
      if (each !== null && input.instalments > 0) {
        await tx.query(
          `INSERT INTO account_membership_payslip_transaction.plan (member, instalments, each, since, prior)
           VALUES ($1, $2, cella.amount($3), cella.verdict_date(),
                   (SELECT count(*) FROM account_membership_payslip_transaction.withheld w WHERE w.member = $1))
           ON CONFLICT (member) DO UPDATE SET instalments = EXCLUDED.instalments, each = EXCLUDED.each, since = EXCLUDED.since, prior = EXCLUDED.prior`,
          [input.member, input.instalments, each],
        )
      }
      return { ...input, each: each ?? 0 }
    },
    // Each instalment is what the member owes: the log keeps its commitment.
    payload: (v) => ({ ...v, each: personal('account_membership_payslip_transaction.plan.each', v.member, v.each) }),
  })
}
