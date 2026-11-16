import type { Refused, Settled } from '@cella/org-actions'
import { write, type Db, type Deps, type Write } from '@cella/org-db'
import { proposing } from '@cella/org-motion/api'
import type { Propose, Proposed } from '@cella/org-motion/models'

// The procedure a motion is decided by, as its requirements fix it on
// the verdict date (`motion.required`), whatever the proposal
// names: what the chains of the mandates its actions act under ask, and
// the protection of each policy it replaces or ends, or its circle's
// procedure. Where no one procedure meets them all, the proposal's, for
// `motion.requires` to refuse saying what they ask.
export async function required(input: Propose, tx: Db): Promise<Propose> {
  const { rows } = await tx.query<{ procedure: string | null }>(
    'SELECT motion.required($1, $2::jsonb, cella.verdict_date()) AS procedure',
    [input.circle, JSON.stringify(input.actions)],
  )
  return { ...input, procedure: rows[0]?.procedure ?? input.procedure }
}

// The proposal with each role it makes given its id, from its name
// (`circle.role_key`), past every circle's and role's and those the
// motion's earlier actions make, whatever id the proposal named: so a
// later seat of the motion names the role by the id it will have, and
// the make takes that id or is refused, never another.
export async function keyed(input: Propose, tx: Db): Promise<Propose> {
  const taken: string[] = []
  const actions: Propose['actions'] = []
  for (const a of input.actions) {
    if (a.kind === 'role') {
      const { rows } = await tx.query<{ id: string }>('SELECT circle.role_key($1, $2::text[]) AS id', [String(a.args?.name ?? ''), taken])
      actions.push({ ...a, args: { ...a.args, id: rows[0].id } })
      taken.push(rows[0].id)
    } else {
      if (a.kind === 'circle' && a.args?.id) {
        taken.push(String(a.args.id))
      }
      actions.push(a)
    }
  }
  return { ...input, actions }
}

// Proposes a motion, in the proposal's one transaction under one
// verdict: the motion feat's proposal, by the procedure its requirements
// fix, which fixes its roll. Each role it makes is given its id
// (`keyed`) before the member signs it, so the entry carries what was
// signed; the guard judges the id again in the transaction.
// The guards of each slice judge it: the
// proposal's own, `motion.fixed` that the roll was fixed among them, and
// `motion.requires` that it is decided as its requirements fix. Every proposal goes through here:
// the motion feat's New form, a member's page and a circle's. What the
// member signs is the proposal without a procedure, since it names none.
export async function propose(input: Propose, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const asked: Propose = await keyed({ ...input }, deps.db)
  delete asked.procedure
  let w: Write<Proposed> = proposing(asked)
  return write(deps, {
    op: w.op,
    request: asked,
    state: async (tx, proof) => {
      w = proposing(await required(asked, tx))
      return w.state(tx, proof)
    },
    payload: (v) => w.payload(v),
  })
}
