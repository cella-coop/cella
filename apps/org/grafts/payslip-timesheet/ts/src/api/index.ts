// The graft's write and its slice, which the shell mounts: preparing a
// month's run from the members' approved time replaces the payslip feat's
// own. The hours show on each payslip, which the feat holds.
import { action, type Slice } from '@cella/org-db'
import { run } from '@cella/org-payslip/api'
import { generate } from '../handlers/generate.ts'

export { generate } from '../handlers/generate.ts'

export const slice: Slice = {
  name: 'payslip-timesheet',
  extends: {
    payslips: {
      actions: {
        generate: action('payslip:run:generate', (form, id) => run(form, id), generate),
      },
    },
  },
}
