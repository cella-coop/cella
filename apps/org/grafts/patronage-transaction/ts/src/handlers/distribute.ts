import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { distributing } from '@cella/org-patronage/api'
import type { Distribute, Distributed } from '@cella/org-patronage/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

// Distributes an approved split and posts it in one write: the patronage
// feat's state, then the entry whose lines `patronage_transaction.lines`
// gives, linked in `distribution`, after which the grafts above credit
// the shares the work share buys as lines of the same entry. The guards
// decide: that the split was approved (`patronage.distributes`), the
// entry (`posted`) and the credits (account-membership-patronage-transaction's).
export async function distribute(input: Distribute, deps: Deps): Promise<Settled<Distributed & { entry: string }> | Refused> {
  const w = distributing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      // No such distribution: nothing to post, and `patronage.distributes`
      // refuses.
      if (!value.distributed) {
        return { ...value, entry: '' }
      }
      const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string }>(
        'SELECT account, side, cents FROM patronage_transaction.lines($1)',
        [input.distribution],
      )
      const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
      const { entry } = await record(tx, { date: value.distributed, label: `Distribution of the ${value.year} surplus`, lines })
      await tx.query('INSERT INTO patronage_transaction.distribution (distribution, entry) VALUES ($1, $2)', [input.distribution, entry])
      return { ...value, entry }
    },
    payload: (v) => ({ ...w.payload(v), entry: v.entry }),
  })
}
