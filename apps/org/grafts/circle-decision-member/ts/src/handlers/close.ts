import type { Refused, Settled } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import { closing } from '@cella/org-decision/api'
import type { Close, Closed } from '@cella/org-decision/models'
import { admitting } from '@cella/org-member/api'
import { seating } from '@cella/org-graft-circle-member/api'

// A member a passing close admitted, with their shares and the seat it
// gave them.
export interface Admitted {
  member: string
  shares: number
  position: number
}

// Closes a decision and, when it passes on its roll, admits everyone it
// admits and seats each in its circle as `member`, all in the close's one
// transaction under one verdict: the decision feat's close, then for each
// admission the member feat's and circle-member's state, which key-member's
// trigger follows by enrolling the invitation's device. The rules of each
// slice judge it: the close's own, `decision_member.closes` that each was
// asked and admitted with its shares, `circle_decision_member.settles`
// that a passing close admitted and seated them all and a failing one no
// one. A refused seat, or a device no invitation carried, refuses the
// whole close.
export async function close(input: Close, deps: Deps): Promise<Settled<Closed & { admitted: Admitted[] }> | Refused> {
  const w = closing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const closed = await w.state(tx, proof)
      const { rows } = await tx.query<{ member: string; shares: number; circle: string }>(
        `SELECT a.member, a.shares, d.circle
         FROM decision_member.motion a JOIN decision.decision d ON d.id = a.decision
         WHERE a.decision = $1 AND a.kind = 'admit' AND d.closed IS NOT NULL
           AND coalesce(circle_decision_member.passes(a.decision), false)
         ORDER BY a.n`,
        [input.decision],
      )
      const admitted: Admitted[] = []
      for (const a of rows) {
        await admitting(tx, { member: a.member, shares: a.shares, decision: input.decision })
        const seat = await seating(tx, { circle: a.circle, member: a.member, role: 'member', decision: input.decision })
        admitted.push({ member: a.member, shares: a.shares, position: seat.position })
      }
      return { ...closed, admitted }
    },
    payload: (v) => ({ ...w.payload(v), admitted: v.admitted.map((a) => ({ member: a.member, position: a.position })) }),
  })
}
