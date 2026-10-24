// The graft's writes: a run's approval and payment with their postings,
// each in one write; its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { run } from '@cella/org-payslip/api'
import { approve, pay } from '../handlers/post.ts'
import { postings } from '../drivers/posting.ts'

export { approve, pay } from '../handlers/post.ts'
export { postings } from '../drivers/posting.ts'

export const slice: Slice = {
  name: 'payslip-transaction',
  extends: {
    payslips: {
      item: postings,
      actions: {
        approve: action('payslip:run:approve', (form, id) => run(form, id), approve),
        pay: action('payslip:run:pay', (form, id) => run(form, id), pay),
      },
    },
  },
}
