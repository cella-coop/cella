// The graft's write, reads and slice, which the shell mounts: an
// associate's instalments from their pay, on their page, and spreading
// what they owe from there; and what a payslip's pay withheld, on the
// payslip's page. Withholding an instalment is this graft's trigger, in
// the write that pays a run.
import { action, type Form, type Slice } from '@cella/org-db'
import { spread } from '../handlers/spread.ts'
import { plan, withheld } from '../drivers/plan.ts'

export { spread } from '../handlers/spread.ts'
export { plan, withheld } from '../drivers/plan.ts'
export type { Instalment, Plan, Withheld } from '../models/plan.ts'

const spreading = (form: Form, member: string | undefined) => {
  const n = Number(form.get('instalments'))
  if (!member) {
    throw new Error('a subscription is a member’s')
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`“${form.get('instalments')}” is not a number of instalments`)
  }
  return { member, instalments: n }
}

export const slice: Slice = {
  name: 'account-member-payslip-transaction',
  extends: {
    members: {
      item: plan,
      actions: {
        spread: action('account:capital:spread', (form, id) => spreading(form, id), spread),
      },
    },
    payslips: { item: withheld },
  },
}
