import type { Refused, Settled } from '@cella/org-ops'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { approving, paying } from '@cella/org-bill/api'
import type { Act, Acted } from '@cella/org-bill/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

type Event = 'charge' | 'payment'

// Posts what a bill event puts in the books: the lines are
// `bill_transaction.lines`, asked of the database, recorded through the
// transaction feat and linked in `posting`. A bill the write did not move
// posts nothing, and the feat's rule refuses it.
async function posted(tx: Db, v: Acted, event: Event): Promise<string | null> {
  if (!v.day || !v.amount) {
    return null
  }
  const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string }>(
    'SELECT account, side, cents FROM bill_transaction.lines($1, $2)',
    [v.bill, event],
  )
  const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
  const label = event === 'charge' ? `Bill ${v.bill}` : `Payment of ${v.bill}`
  const { entry } = await record(tx, { date: v.day, label, lines })
  await tx.query('INSERT INTO bill_transaction.posting (entry, bill, event) VALUES ($1, $2, $3)', [entry, v.bill, event])
  return entry
}

function posting(w: Write<Acted>, event: Event): Write<Acted & { entry: string | null }> {
  return {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      return { ...value, entry: await posted(tx, value, event) }
    },
    payload: (v) => ({ ...w.payload(v), entry: v.entry }),
  }
}

// Approves a bill and charges it: its category and deductible VAT
// debited, what is owed the supplier (401) credited. The approver's limit
// caps its total.
export async function approve(input: Act, deps: Deps): Promise<Settled<Acted & { entry: string | null }> | Refused> {
  return write(deps, posting(approving(input, deps.actor), 'charge'))
}

// Pays an approved bill: what is owed the supplier settled from the bank,
// under pay-supplier and its limit.
export async function pay(input: Act, deps: Deps): Promise<Settled<Acted & { entry: string | null }> | Refused> {
  return write(deps, posting(paying(input), 'payment'))
}
