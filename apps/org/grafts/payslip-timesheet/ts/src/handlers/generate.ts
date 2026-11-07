import type { Refused, Settled } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import { generating, timing } from '@cella/org-payslip/api'
import type { Ran, Run } from '@cella/org-payslip/models'

// Prepares a month's run from approved time: the payslip feat's payslips,
// then each one's minutes from its member's month, which the payslip feat
// sets, in one write. `payslip_timesheet.timed` refuses it while any
// member's month is not approved.
export async function generate(input: Run, deps: Deps): Promise<Settled<Ran & { minutes: number }> | Refused> {
  const w = generating(input)
  // Each payslip's minutes, which its payload commits to for its fold.
  let timed: { member: string; minutes: number }[] = []
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const value = await w.state(tx, proof)
      const { rows } = await tx.query<{ member: string; minutes: number }>(
        `SELECT p.member, payslip_timesheet.minutes(p.member, p.month) AS minutes FROM payslip.payslip p WHERE p.month = $1 ORDER BY p.member`,
        [input.month],
      )
      timed = rows
      return { ...value, minutes: await timing(tx, input.month, rows) }
    },
    payload: (v) => ({
      ...w.payload(v),
      minutes: v.minutes,
      timed: timed.map((t) => ({ member: t.member, minutes: personal('payslip.payslip.minutes', t.member, t.minutes) })),
    }),
  })
}
