import type { Refused, Settled } from '@cella/org-ops'
import type { Deps } from '@cella/org-db'
import { admit } from '@cella/org-member/api'
import type { Admitted } from '@cella/org-member/models'
import { add } from '@cella/org-graft-circle-member/api'
import type { Added } from '@cella/org-graft-circle-member/models'

// What a passing close did for one member it admits: the admission, and,
// once that settled, their seat in the decision's circle.
export interface Admission {
  admitted: Settled<Admitted> | Refused
  seated: Settled<Added> | Refused | null
}

// Reacts to a settled close: admits each member the decision asks to admit
// (`decision_member.admission`, a lower-order graft's), when it passes on
// its roll (`circle_decision_member.passes`), asked of the database, then
// seats them in the decision's circle in its `member` role, through
// circle-member's write. Each is its own ordered write, decided again by
// its rules; a seat follows only a settled admission.
export async function closed(decision: string, deps: Deps): Promise<Admission[]> {
  const { rows } = await deps.db.query<{ member: string; shares: number; circle: string; passes: boolean }>(
    `SELECT a.member, a.shares, d.circle, circle_decision_member.passes(a.decision) AS passes
     FROM decision_member.admission a
     JOIN decision.decision d ON d.id = a.decision
     WHERE a.decision = $1
     ORDER BY a.member`,
    [decision],
  )
  const out: Admission[] = []
  for (const a of rows.filter((r) => r.passes)) {
    const admitted = await admit({ member: a.member, shares: a.shares, decision }, deps)
    if (admitted.state === 'pending') {
      throw new Error('an admission on the server settles or is refused at once')
    }
    let seated: Admission['seated'] = null
    if (admitted.state === 'settled') {
      const seat = await add({ circle: a.circle, member: a.member, role: 'member', decision }, deps)
      if (seat.state === 'pending') {
        throw new Error('a seat on the server settles or is refused at once')
      }
      seated = seat
    }
    out.push({ admitted, seated })
  }
  return out
}
