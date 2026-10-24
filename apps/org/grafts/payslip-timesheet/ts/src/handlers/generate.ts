import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { generating } from '@cella/org-payslip/api'
import type { Ran, Run } from '@cella/org-payslip/models'

// Prepares a month's run from approved time: the payslip feat's payslips,
// then each one's minutes from its member's month, in one write.
// `payslip_timesheet.timed` refuses it while any member's month is not
// approved.
export async function generate(input: Run, deps: Deps): Promise<Settled<Ran & { minutes: number }> | Refused> {
  const w = generating(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const { rows } = await tx.query<{ minutes: string }>(
        `WITH timed AS (
           UPDATE payslip.payslip SET minutes = payslip_timesheet.minutes(member, month) WHERE month = $1 RETURNING minutes
         )
         SELECT coalesce(sum(minutes), 0) AS minutes FROM timed`,
        [input.month],
      )
      return { ...value, minutes: Number(rows[0].minutes) }
    },
    payload: (v) => ({ ...w.payload(v), minutes: v.minutes }),
  })
}
