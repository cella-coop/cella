import type { Refused, Settled } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { issuing, paying, voiding } from '@cella/org-invoice/api'
import type { Issue, Issued, Paid, Payment, Void, Voided } from '@cella/org-invoice/models'
import { logged, record } from '@cella/org-transaction/api'
import type { Entry, Line } from '@cella/org-transaction/models'

type Event = 'issue' | 'payment' | 'void'

// Posts what an invoice event puts in the books: the lines are
// `invoice_transaction.lines` or `.payment_lines`, asked of the database,
// recorded through the transaction feat and linked in `posting`.
async function posted(tx: Db, invoice: string, event: Event, date: string, label: string, payment?: number) {
  const { rows } = await tx.query<{ account: string; side: Line['side']; cents: string }>(
    event === 'payment'
      ? 'SELECT account, side, cents FROM invoice_transaction.payment_lines($1)'
      : 'SELECT account, side, cents FROM invoice_transaction.lines($1, $2)',
    event === 'payment' ? [payment] : [invoice, event],
  )
  const lines = rows.map((r) => ({ account: r.account, side: r.side, cents: Number(r.cents) }))
  const posting = { date, label, lines }
  const { entry } = await record(tx, posting)
  await tx.query(
    'INSERT INTO invoice_transaction.posting (entry, invoice, event, payment) VALUES ($1, $2, $3, $4)',
    [entry, invoice, event, payment ?? null],
  )
  return { entry, posting }
}

// An invoice write with its posting, in one transaction under one verdict:
// the invoice feat's state, then the entry, and the entry in the payload,
// with its date, label and lines as the journal shows them (`logged`), so
// its fold posts it again.
function posting<T>(w: Write<T>, post: (tx: Db, value: T) => Promise<{ entry: string; posting: Entry } | null>): Write<T & { entry: string | null }> {
  let kept: Entry | null = null
  return {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const made = await post(tx, value)
      kept = made?.posting ?? null
      return { ...value, entry: made?.entry ?? null }
    },
    payload: (v) => ({ ...w.payload(v), entry: v.entry, ...(kept ? { posting: logged(kept) } : {}) }),
  }
}

// Issues an invoice and posts it: clients debited by the total, services
// and VAT collected credited. `invoice_transaction.issued` checks the entry.
export async function issue(input: Issue, deps: Deps): Promise<Settled<Issued & { entry: string | null }> | Refused> {
  return write(deps, posting(issuing(input), (tx, v) => posted(tx, v.invoice, 'issue', v.issued, `Invoice ${v.invoice}`)))
}

// Records a payment and posts it: the bank debited, clients credited. A
// merged payment posts nothing, since nothing new was paid.
export async function payment(input: Payment, deps: Deps): Promise<Settled<Paid & { entry: string | null }> | Refused> {
  return write(deps, posting(paying(input), async (tx, v) =>
    v.merged ? null : posted(tx, v.invoice, 'payment', v.at, `Payment of ${v.invoice}`, v.payment)))
}

// Voids an invoice and posts its credit note, reversing the issue.
// `invoice.voids` refuses it once a payment exists, and the credit note
// rolls back with it.
export async function annul(input: Void, deps: Deps): Promise<Settled<Voided & { entry: string | null }> | Refused> {
  return write(deps, posting(voiding(input), (tx, v) =>
    posted(tx, v.invoice, 'void', v.voided, `Credit note for ${v.invoice}, voided`)))
}
