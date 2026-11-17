// The feat's public writes, POST /api/payslip/<op> once the server exists,
// the write specs a graft composes, its reads, and its slice, which the
// shell mounts.
import type { Form, Slice } from '@cella/org-db'
import { listing, next, payslip, payslips } from '../drivers/payslip.ts'
import type { Run } from '../models/payslip.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'

export { approve, approving, generate, generating, pay, paying, timing } from '../handlers/index.ts'
export { next, payslip, payslips } from '../drivers/payslip.ts'
export { saveBody } from '../handlers/body.ts'

// The run a form names, `YYYY-MM`, or the run of the payslip a page shows.
export function run(form: Form, id: string | undefined): Run {
  const month = form.get('month') || (id ?? '').split('~')[0]
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`“${month}” is not a month, YYYY-MM`)
  }
  return { month }
}

// The payslips. Preparing a run needs each member's approved time, and
// approving and paying one post to the books, so those writes are the
// payslip-timesheet and payslip-transaction grafts'.
export const slice: Slice = {
  name: 'payslip',
  queries: contract,
  collections: {
    payslips: {
      list: listing,
      about: next,
      item: withBody(payslip),
      index: async (db) => (await payslips(db)).map((p) => ({ id: p.id, title: `Payslip ${p.month}`, sub: `${p.member}, ${p.state}` })),
      body: bodyMount,
      actions: {
        ...bodyActions,
      },
    },
  },
}
