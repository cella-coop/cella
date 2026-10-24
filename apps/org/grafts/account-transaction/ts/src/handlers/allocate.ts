import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { allocating } from '@cella/org-account/api'
import type { Allocate, Allocated } from '@cella/org-account/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

// Allocates a year's surplus and posts its split in one write: the account
// feat's state, then the entry whose lines `account_transaction.
// allocation_lines` gives, linked in `allocation`. The rules decide: the
// split and the law's floors (`account.splits`, and the legal reserve's
// here), the entry (`allocated`), and the decision it cites, through the
// account-decision and circle-decision-member grafts.
export async function allocate(input: Allocate, deps: Deps): Promise<Settled<Allocated & { entry: string }> | Refused> {
  const w = allocating(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      // No such allocation: nothing to post, and `account.splits` refuses.
      if (!value.allocated) {
        return { ...value, entry: '' }
      }
      const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string }>(
        'SELECT account, side, cents FROM account_transaction.allocation_lines($1)',
        [input.allocation],
      )
      const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
      const { entry } = await record(tx, { date: value.allocated, label: `Allocation of the ${value.year} surplus`, lines })
      await tx.query('INSERT INTO account_transaction.allocation (allocation, entry) VALUES ($1, $2)', [input.allocation, entry])
      return { ...value, entry }
    },
    payload: (v) => ({ ...w.payload(v), entry: v.entry }),
  })
}
