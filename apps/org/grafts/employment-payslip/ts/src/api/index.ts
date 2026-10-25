// The graft's reads and its slice, which the shell mounts: whose each
// payslip is, each worker's salary, and a worker's pay on their page.
import type { Slice } from '@cella/org-db'
import { names, pay, salaries } from '../drivers/pay.ts'

export { names, pay, salaries } from '../drivers/pay.ts'

export const slice: Slice = {
  name: 'employment-payslip',
  extends: {
    payslips: { list: names },
    people: { list: salaries, item: pay },
  },
}
