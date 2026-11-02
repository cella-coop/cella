import type { Refused, Settled } from '@cella/org-actions'
import { done, write, type Deps, type Done } from '@cella/org-db'
import { distributing } from '@cella/org-patronage/api'
import type { Distribute, Distributed } from '@cella/org-patronage/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

// Distributes an approved split and posts it in one write: the patronage
// feat's state, then the entry whose lines `patronage_transaction.lines`
// gives, linked in `distribution`. It cites the motion that approved the
// split. The guards decide: that the split was approved
// (`patronage.distributes`), by that motion (motion-patronage's), and
// that the entry posts exactly the split (`posted`).
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

// What follows an approval: the split distributed and posted, a write of
// its own signed by whoever signed the approval and citing its motion,
// with the request the reactions to a distribution read, so the credits
// of shares follow it.
export async function distributed(request: unknown, deps: Deps): Promise<Done[]> {
  const { distribution, motion } = request as Distribute
  const input = { distribution, motion }
  return [done('patronage:distribution:distribute', await distribute(input, deps), [], input)]
}
