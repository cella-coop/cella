import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Entry, Payroll, Posted } from '../models/transaction.ts'
import { committed, record } from './record.ts'

const op = 'transaction:transaction:payroll' satisfies keyof typeof ops

const entry = (input: Payroll): Entry => ({
  date: input.date,
  label: input.label,
  lines: [
    { account: '641', side: 'debit', cents: input.wages },
    { account: '645', side: 'debit', cents: input.charges },
    { account: '512', side: 'credit', cents: input.wages + input.charges },
  ],
})

export const running = (input: Payroll): Write<Posted> => ({
  op,
  request: input,
  state: (tx) => record(tx, entry(input)),
  payload: (posted) => committed(posted, entry(input)),
})

// Runs a month's payroll: wages and charges against the bank, until the
// payslip feat posts each payslip. Confluent, as any entry; it needs
// run-payroll, and `transaction.payroll` checks the entry is a payroll and
// nothing else.
export async function payroll(input: Payroll, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Posted>> {
  return write(deps, running(input))
}
