import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { generating, timing } from '@cella/org-payslip/api'
import type { Ran, Run } from '@cella/org-payslip/models'

// Prepares a month's run from approved time: the payslip feat's payslips,
// then each one's minutes from its member's month, which the payslip feat
// sets, in one write. `payslip_timesheet.timed` refuses it while any
// member's month is not approved.
export async function generate(input: Run, deps: Deps): Promise<Settled<Ran & { minutes: number }> | Refused> {
  const w = generating(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const { rows } = await tx.query<{ member: string; minutes: number }>(
        `SELECT p.member, payslip_timesheet.minutes(p.member, p.month) AS minutes FROM payslip.payslip p WHERE p.month = $1`,
        [input.month],
      )
      return { ...value, minutes: await timing(tx, input.month, rows) }
    },
    payload: (v) => ({ ...w.payload(v), minutes: v.minutes }),
  })
}
