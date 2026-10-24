import type { Refused, Settled } from '@cella/org-ops'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { approving, reimbursing } from '@cella/org-expense/api'
import type { Act, Acted } from '@cella/org-expense/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

type Event = 'charge' | 'payment'

// Posts what an expense event puts in the books: the lines are
// `expense_transaction.lines`, asked of the database, recorded through the
// transaction feat and linked in `posting`. An expense the write did not
// move posts nothing, and the feat's rule refuses it.
async function posted(tx: Db, v: Acted, event: Event): Promise<string | null> {
  if (!v.day || !v.amount) {
    return null
  }
  const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string }>(
    'SELECT account, side, cents FROM expense_transaction.lines($1, $2)',
    [v.expense, event],
  )
  const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
  const label = event === 'charge' ? `Expense ${v.expense}` : `Reimbursement of ${v.expense}`
  const { entry } = await record(tx, { date: v.day, label, lines })
  await tx.query('INSERT INTO expense_transaction.posting (entry, expense, event) VALUES ($1, $2, $3)', [entry, v.expense, event])
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

// Approves an expense and charges it: its category and deductible VAT
// debited, what is owed the member (421) credited. The approver's limit
// and budget cap its amount.
export async function approve(input: Act, deps: Deps): Promise<Settled<Acted & { entry: string | null }> | Refused> {
  return write(deps, posting(approving(input, deps.actor), 'charge'))
}

// Reimburses an approved expense: what is owed the member settled from
// the bank, under reimburse-expense and its limit.
export async function reimburse(input: Act, deps: Deps): Promise<Settled<Acted & { entry: string | null }> | Refused> {
  return write(deps, posting(reimbursing(input), 'payment'))
}
