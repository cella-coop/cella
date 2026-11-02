import { done, type Deps, type Done } from '@cella/org-db'
import type { Pending, Permission, Refused, Settled } from '@cella/org-actions'
import { erase, exit, suspend } from '@cella/org-membership/api'
import { nest } from '@cella/org-circle/api'
import { add, remove } from '@cella/org-graft-circle-membership/api'
import { adopt, end } from '@cella/org-graft-circle-motion/api'

type Args = Record<string, string | number | undefined>

const text = (v: unknown) => (v === undefined || v === null ? null : String(v))

// How each kind of action is carried out: the decided write it makes, citing
// the motion. Admissions are not here: the close carries them itself.
const writes: Record<string, { op: Permission; run: (a: Args, motion: string, deps: Deps, n: number) => Promise<Settled<unknown> | Pending | Refused> }> = {
  suspend: { op: 'membership:member:suspend', run: (a, motion, deps) => suspend({ member: String(a.member), motion }, deps) },
  exit: { op: 'membership:member:exit', run: (a, motion, deps) => exit({ member: String(a.member), motion }, deps) },
  erase: { op: 'membership:member:erase', run: (a, motion, deps) => erase({ member: String(a.member), motion }, deps) },
  nest: { op: 'circle:circle:nest', run: (a, motion, deps) => nest({ circle: String(a.circle), parent: String(a.parent), motion }, deps) },
  policy: { op: 'motion:policy:adopt', run: (_, motion, deps, n) => adopt({ motion, n }, deps) },
  end: { op: 'motion:policy:end', run: (_, motion, deps, n) => end({ motion, n }, deps) },
  seat: {
    op: 'circle-membership:seat:add',
    run: (a, motion, deps) => add({ circle: String(a.circle), member: String(a.member), role: text(a.role), motion }, deps),
  },
  unseat: {
    op: 'circle-membership:seat:remove',
    run: (a, motion, deps) => remove({ circle: String(a.circle), member: String(a.member), role: text(a.role), motion }, deps),
  },
}

// Carries out what a passing motion decides beyond admissions, once its
// close has settled: each action, in the order proposed, as its own
// decided write, signed as the member who closed it and judged again by
// its guards. A refused one leaves the motion passed and that action
// undone, as its outcome says; the others still go. Before them it
// reports each admission the close made, settled in the close's entry,
// with the request an admission of its own carries, so what reacts to an
// admission follows it, as each carried write's reactions follow it. It
// reads outside a write, so whether the motion passed comes from its
// tally, which a secret ballot opens at its close.
export async function carried(motion: string, deps: Deps): Promise<Done[]> {
  const { rows } = await deps.db.query<{ n: number; kind: string; args: Args }>(
    `SELECT m.n, m.kind, m.args FROM motion.action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.motion = $1 AND d.closed IS NOT NULL AND coalesce((circle_membership_motion.tally(d.id)).passes, false)
     ORDER BY m.n`,
    [motion],
  )
  const out: Done[] = []
  for (const m of rows) {
    if (m.kind === 'admit') {
      out.push({ op: 'membership:member:admit', state: 'settled', then: [], request: { member: String(m.args.member), shares: Number(m.args.shares), motion } })
      continue
    }
    const w = writes[m.kind]
    if (w) {
      const input = { ...m.args, motion }
      out.push(done(w.op, await w.run(m.args, motion, deps, m.n), [], input))
    }
  }
  return out
}
