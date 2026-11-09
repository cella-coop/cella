import type { Refused, Settled } from '@cella/org-actions'
import { personal, write, type Db, type Deps, type Write } from '@cella/org-db'
import { approving, paying } from '@cella/org-payslip/api'
import type { Ran, Run } from '@cella/org-payslip/models'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry, Line } from '@cella/org-transaction/models'

type Event = 'accrual' | 'payment'

// A personal figure a graft above kept of a payment's lines, by its
// personal column and its subject.
type Kept = { field: string; subject: string; cents: number }

// Posts what a run's event puts in the books: the lines are
// `payslip_transaction.lines`, asked of the database, and on a payment
// those the grafts above registered beside them, `payslip_transaction.added`,
// each naming whose figure it is where it is a person's;
// recorded through the transaction feat and linked in `posting`, after
// which each graft above keeps what it added, `payslip_transaction.keep`,
// answering the personal figures it kept.
// The accrual is dated the run's last day, so it lands in the month the
// pay is for; the payment the day it was paid. A run the write did not
// move posts nothing, and the feat's guard refuses it.
async function posted(tx: Db, v: Ran, event: Event): Promise<{ entry: string; posting: Entry; kept: Kept[] } | null> {
  if (!v.day) {
    return null
  }
  const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string; day: string }>(
    `SELECT l.account, l.side, l.cents, to_char(payslip.after($1) - 1, 'YYYY-MM-DD') AS day
     FROM payslip_transaction.lines($1, $2) l`,
    [v.month, event],
  )
  const added =
    event === 'payment'
      ? (await tx.query<{ account: string; side: Line['side']; cents: string; person: string | null }>('SELECT account, side, cents, person FROM payslip_transaction.added($1)', [v.month])).rows
      : []
  const lines = [
    ...rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) })),
    ...added.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents), ...(r.person ? { person: r.person } : {}) })),
  ]
  const date = event === 'accrual' ? (rows[0]?.day ?? v.day) : v.day
  const label = event === 'accrual' ? `Payroll, ${v.month}` : `Payroll paid, ${v.month}`
  const posting = { date, label, lines }
  const { entry } = await record(tx, posting)
  await tx.query('INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, $2, $3)', [entry, v.month, event])
  const kept =
    event === 'payment'
      ? (await tx.query<{ field: string; subject: string; cents: string }>('SELECT field, subject, cents FROM payslip_transaction.keep($1, $2)', [v.month, entry])).rows.map(
          (k) => ({ field: k.field, subject: k.subject, cents: Number(k.cents) }),
        )
      : []
  return { entry, posting, kept }
}

function posting(w: Write<Ran>, event: Event): Write<Ran & { entry: string | null }> {
  // The entry it posts and the personal figures the grafts above kept of
  // it, which its payload keeps for their folds, each as its commitment.
  let made: { posting: Entry; kept: Kept[] } | null = null
  return {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const done = await posted(tx, value, event)
      made = done
      return { ...value, entry: done?.entry ?? null }
    },
    payload: (v) => ({
      ...w.payload(v),
      entry: v.entry,
      ...(made
        ? {
            posting: logged(made.posting),
            ...(made.kept.length ? { kept: made.kept.map((k) => ({ field: k.field, subject: k.subject, cents: personal(k.field, k.subject, k.cents) })) } : {}),
          }
        : {}),
    }),
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
