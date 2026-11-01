import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { closing } from '@cella/org-motion/api'
import type { Close, Closed } from '@cella/org-motion/models'
import { admitting } from '@cella/org-membership/api'
import { seating } from '@cella/org-graft-circle-membership/api'

// A member a passing close admitted, with their shares and the seat it
// gave them.
export interface Admitted {
  member: string
  shares: number
  position: number
}

// Closes a motion, counts its roll and, when it passes on it, admits
// everyone it admits and seats each in its circle as `member`, all in the
// close's one transaction under one verdict: the motion feat's close,
// then who is counted, the roll's members active that day, then for each
// admission the membership feat's and circle-membership's state. The guards
// of each slice judge it: the close's own, `counts` that the roll was
// counted, `membership_motion.closes` that each was asked and admitted
// with its shares, `circle_membership_motion.settles` that a passing
// close admitted and seated them all and a failing one no one. A refused
// seat refuses the whole close.
export async function close(input: Close, deps: Deps): Promise<Settled<Closed & { admitted: Admitted[] }> | Refused> {
  const w = closing(input)
  return write(deps, {
    op: w.op,
    request: w.request,
    state: async (tx, proof) => {
      const closed = await w.state(tx, proof)
      await tx.query('SELECT circle_membership_motion.count($1)', [input.motion])
      const { rows } = await tx.query<{ member: string; shares: number; circle: string }>(
        `SELECT a.member, a.shares, d.circle
         FROM membership_motion.action a JOIN motion.motion d ON d.id = a.motion
         WHERE a.motion = $1 AND a.kind = 'admit' AND d.closed IS NOT NULL
           AND coalesce(circle_membership_motion.passes(a.motion), false)
         ORDER BY a.n`,
        [input.motion],
      )
      const admitted: Admitted[] = []
      for (const a of rows) {
        await admitting(tx, { member: a.member, shares: a.shares, motion: input.motion })
        const seat = await seating(tx, { circle: a.circle, member: a.member, role: 'member', motion: input.motion })
        admitted.push({ member: a.member, shares: a.shares, position: seat.position })
      }
      return { ...closed, admitted }
    },
    payload: (v) => ({ ...w.payload(v), admitted: v.admitted.map((a) => ({ member: a.member, position: a.position })) }),
  })
}
