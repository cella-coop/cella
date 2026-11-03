import type { Refused, Settled } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { proposing } from '@cella/org-motion/api'
import type { Propose, Proposed } from '@cella/org-motion/models'

// The procedure a motion is decided by, as its requirements fix it on
// the verdict date (`circle_motion.required`), whatever the proposal
// names: what the chains of the mandates its actions act under ask, and
// the protection of each policy it replaces or ends, or its circle's
// procedure. Where no one procedure meets them all, the proposal's, for
// `circle_motion.requires` to refuse saying what they ask.
export async function required(input: Propose, tx: Db): Promise<Propose> {
  const { rows } = await tx.query<{ procedure: string | null }>(
    'SELECT circle_motion.required($1, $2::jsonb, cella.verdict_date()) AS procedure',
    [input.circle, JSON.stringify(input.actions)],
  )
  return { ...input, procedure: rows[0]?.procedure ?? input.procedure }
}

// Proposes a motion and fixes its roll, in the proposal's one
// transaction under one verdict: the motion feat's proposal, by the
// procedure its requirements fix, then the members seated in its circle
// that day. The guards of each slice judge it: the proposal's own,
// `circle_motion.requires` that it is decided as its requirements fix,
// and `fixed` that the roll was fixed. Every proposal goes through here:
// the motion feat's New form, a member's page and a circle's. What the
// member signs is the proposal without a procedure, since it names none.
export async function propose(input: Propose, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const asked: Propose = { ...input }
  delete asked.procedure
  let w: Write<Proposed> = proposing(asked)
  return write(deps, {
    op: w.op,
    request: asked,
    state: async (tx, proof) => {
      w = proposing(await required(asked, tx))
      const proposed = await w.state(tx, proof)
      await tx.query('SELECT circle_membership_motion.fix($1)', [proposed.motion])
      return proposed
    },
    payload: (v) => w.payload(v),
  })
}
