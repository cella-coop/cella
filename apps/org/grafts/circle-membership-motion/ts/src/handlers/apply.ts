import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import { applying } from '@cella/org-membership/api'
import { proposing } from '@cella/org-motion/api'
import type { Propose, Proposed } from '@cella/org-motion/models'
import { required } from './propose.ts'
import type { Applying } from '../models/asking.ts'

export interface Applied {
  member: string
  applied: string
  motion: string
  proposed: string
}

// An employee's application, by their own right: in one transaction under
// one verdict, the membership feat's application, which invites them, the
// motion feat's proposal of their admission to the assembly, by the
// procedure its requirements fix and a secret ballot as `put` names one,
// and its roll, fixed as `propose` fixes it. Its op is the application's, judged by
// `membership.applies`, the year employment-membership's `serves` asks,
// and this graft's `puts`, which runs the proposal's own guards over the
// motion; no seat is asked of the applicant, whose right puts it. The
// request carries the shares, so the candidacy that follows pledges them.
export async function apply(input: Applying, deps: Deps): Promise<Settled<Applied> | Refused> {
  const { rows } = await deps.db.query<{ decider: string; name: string | null }>(
    `SELECT d.id AS decider, (SELECT p.name FROM person.person p WHERE p.address = $1) AS name
     FROM circle.circle d WHERE d.assembly`,
    [input.member],
  )
  const found = rows[0]
  if (!found) {
    throw new Error('no circle decides this: the co-op has no assembly')
  }
  const a = applying({ member: input.member })
  const proposal: Propose = {
    circle: found.decider,
    title: `Admit ${found.name ?? input.member} as a member`,
    ballot: 'secret',
    deadline: input.deadline,
    body: input.body,
    actions: [{ kind: 'admit', args: { member: input.member, shares: input.shares } }],
  }
  let p: Write<Proposed> | undefined
  let proposed: Proposed | undefined
  return write(deps, {
    op: a.op,
    request: input,
    state: async (tx, proof) => {
      const applied = await a.state(tx, proof)
      p = proposing(await required(proposal, tx))
      proposed = await p.state(tx, proof)
      await tx.query('SELECT circle_membership_motion.fix($1)', [proposed.motion])
      return { ...applied, motion: proposed.motion, proposed: proposed.proposed }
    },
    payload: (v) => ({ ...a.payload(v), ...(p && proposed ? p.payload(proposed) : {}) }),
  })
}
