import type { Refused, Settled } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { approving, paying } from '@cella/org-payslip/api'
import type { Ran, Run } from '@cella/org-payslip/models'
import { record } from '@cella/org-transaction/api'
import type { Line } from '@cella/org-transaction/models'

type Event = 'accrual' | 'payment'

// Posts what a run's event puts in the books: the lines are
// `payslip_transaction.lines`, asked of the database, recorded through
// the transaction feat and linked in `posting`. The accrual is dated the
// run's last day, so it lands in the month the pay is for; the payment
// the day it was paid. A run the write did not move posts nothing, and
// the feat's guard refuses it.
async function posted(tx: Db, v: Ran, event: Event): Promise<string | null> {
  if (!v.day) {
    return null
  }
  const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string; day: string }>(
    `SELECT l.account, l.side, l.cents, to_char(payslip.after($1) - 1, 'YYYY-MM-DD') AS day
     FROM payslip_transaction.lines($1, $2) l`,
    [v.month, event],
  )
  const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
  const date = event === 'accrual' ? (rows[0]?.day ?? v.day) : v.day
  const label = event === 'accrual' ? `Payroll, ${v.month}` : `Payroll paid, ${v.month}`
  const { entry } = await record(tx, { date, label, lines })
  await tx.query('INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, $2, $3)', [entry, v.month, event])
  return entry
}

function posting(w: Write<Ran>, event: Event): Write<Ran & { entry: string | null }> {
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

// Approves a run and accrues it: gross pay and the employer's
// contributions charged, net pay owed the members and contributions owed
// the social funds.
export async function approve(input: Run, deps: Deps): Promise<Settled<Ran & { entry: string | null }> | Refused> {
  return write(deps, posting(approving(input, deps.actor), 'accrual'))
}

// Pays an approved run from the bank: what the members and the social
// funds are owed, settled.
export async function pay(input: Run, deps: Deps): Promise<Settled<Ran & { entry: string | null }> | Refused> {
  return write(deps, posting(paying(input), 'payment'))
}
