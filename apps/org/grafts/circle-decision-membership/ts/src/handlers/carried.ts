import { done, type Deps, type Done } from '@cella/org-db'
import type { Pending, Permission, Refused, Settled } from '@cella/org-actions'
import { erase, exit, suspend } from '@cella/org-membership/api'
import { grant, nest, revoke } from '@cella/org-circle/api'
import { add, remove } from '@cella/org-graft-circle-membership/api'

type Args = Record<string, string | number | undefined>

const cents = (euros: unknown) => (euros === undefined || euros === null ? undefined : Math.round(Number(euros) * 100))
const text = (v: unknown) => (v === undefined || v === null ? null : String(v))

// How each kind of motion is carried out: the decided write it makes, citing
// the decision. Admissions are not here: the close carries them itself.
const writes: Record<string, { op: Permission; run: (a: Args, decision: string, deps: Deps) => Promise<Settled<unknown> | Pending | Refused> }> = {
  suspend: { op: 'membership:member:suspend', run: (a, decision, deps) => suspend({ member: String(a.member), decision }, deps) },
  exit: { op: 'membership:member:exit', run: (a, decision, deps) => exit({ member: String(a.member), decision }, deps) },
  erase: { op: 'membership:member:erase', run: (a, decision, deps) => erase({ member: String(a.member), decision }, deps) },
  nest: { op: 'circle:circle:nest', run: (a, decision, deps) => nest({ circle: String(a.circle), parent: String(a.parent), decision }, deps) },
  grant: {
    op: 'circle:mandate:grant',
    run: (a, decision, deps) =>
      grant(
        {
          role: String(a.role),
          power: String(a.power),
          text: String(a.text ?? a.power),
          limit: cents(a.limit),
          budget: cents(a.budget),
          per: a.per === 'month' || a.per === 'year' ? a.per : undefined,
          decision,
        },
        deps,
      ),
  },
  revoke: { op: 'circle:mandate:revoke', run: (a, decision, deps) => revoke({ mandate: Number(a.mandate), decision }, deps) },
  seat: {
    op: 'circle-membership:position:add',
    run: (a, decision, deps) => add({ circle: String(a.circle), member: String(a.member), role: text(a.role), decision }, deps),
  },
  unseat: {
    op: 'circle-membership:position:remove',
    run: (a, decision, deps) => remove({ circle: String(a.circle), member: String(a.member), role: text(a.role), decision }, deps),
  },
}

// Carries out what a passing decision decides beyond admissions, once its
// close has settled: each motion, in the order proposed, as its own
// decided write, signed as the member who closed it and judged again by
// its guards. A refused one leaves the decision passed and that motion
// undone, as its outcome says; the others still go. It reads outside a
// write, so whether the decision passed comes from its tally, which a
// secret ballot opens at its close.
export async function carried(decision: string, deps: Deps): Promise<Done[]> {
  const { rows } = await deps.db.query<{ kind: string; args: Args }>(
    `SELECT m.kind, m.args FROM decision.motion m JOIN decision.decision d ON d.id = m.decision
     WHERE m.decision = $1 AND d.closed IS NOT NULL AND coalesce((circle_decision_membership.tally(d.id)).passes, false)
     ORDER BY m.n`,
    [decision],
  )
  const out: Done[] = []
  for (const m of rows) {
    const w = writes[m.kind]
    if (w) {
      out.push(done(w.op, await w.run(m.args, decision, deps)))
    }
  }
  return out
}
