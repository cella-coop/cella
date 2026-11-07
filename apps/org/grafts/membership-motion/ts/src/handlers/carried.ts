import { done, write, type Deps, type Done } from '@cella/org-db'
import type { Pending, Permission, Refused, Settled } from '@cella/org-actions'
import { admitting, exclude, suspend } from '@cella/org-membership/api'
import { add, amend, create, remove, seatRole, seating, unseatRole } from '@cella/org-circle/api'
import { circles } from '@cella/org-motion/api'

type Args = Record<string, string | number | undefined>

const text = (v: unknown) => (v === undefined || v === null ? null : String(v))

// A member a passing close admitted, with their shares and the seat it
// gave them.
export interface Admitted {
  member: string
  shares: number
  seat: number
}

// Admits a member the motion admits and seats them in its circle as
// `member`, in one effect of the close: the membership feat's `admitting`,
// then core's `seating`. `membership.admitted`, `membership_motion.admits`
// and `membership_motion.closes` judge it, that they were admitted with
// the shares the motion asks and seated as its circle asks; a refused
// seat refuses the admission. The subscription that follows it is an
// effect it requires.
function admit(input: { member: string; shares: number; motion: string; circle: string }, deps: Deps): Promise<Settled<Admitted> | Refused> {
  const request = { member: input.member, shares: input.shares, motion: input.motion }
  return write(deps, {
    op: 'membership:member:admit',
    request,
    state: async (tx) => {
      await admitting(tx, request)
      const added = await seating(tx, { circle: input.circle, member: input.member, role: 'member', motion: input.motion })
      return { member: input.member, shares: input.shares, seat: added.seat }
    },
    payload: (v) => ({ ...request, circle: input.circle, seat: v.seat }),
  })
}

// How each kind of action is carried out: the write it makes, citing the
// motion.
const writes: Record<string, { op: Permission; run: (a: Args, motion: string, deps: Deps, n: number, circle: string) => Promise<Settled<unknown> | Pending | Refused> }> = {
  admit: {
    op: 'membership:member:admit',
    run: (a, motion, deps, _, circle) => admit({ member: String(a.member), shares: Number(a.shares), motion, circle }, deps),
  },
  suspend: { op: 'membership:member:suspend', run: (a, motion, deps) => suspend({ member: String(a.member), motion }, deps) },
  exclude: { op: 'membership:member:exclude', run: (a, motion, deps) => exclude({ member: String(a.member), motion }, deps) },
  policy: { op: 'motion:policy:adopt', run: (_, motion, deps, n) => circles.adopt({ motion, n }, deps) },
  end: { op: 'motion:policy:end', run: (_, motion, deps, n) => circles.end({ motion, n }, deps) },
  circle: {
    op: 'circle:circle:create',
    run: (a, motion, deps) => create({ id: String(a.id), name: String(a.name), purpose: text(a.purpose) ?? '', motion }, deps),
  },
  'amend-circle': {
    op: 'circle:circle:amend',
    run: (a, motion, deps) => amend({ circle: String(a.circle), name: text(a.name), purpose: text(a.purpose), procedure: text(a.procedure), motion }, deps),
  },
  seat: {
    op: 'circle:seat:add',
    run: (a, motion, deps) => add({ circle: String(a.circle), member: String(a.member), role: text(a.role), motion }, deps),
  },
  unseat: {
    op: 'circle:seat:remove',
    run: (a, motion, deps) => remove({ circle: String(a.circle), member: String(a.member), role: text(a.role), motion }, deps),
  },
  'seat-role': {
    op: 'circle:role:seat',
    run: (a, motion, deps) => seatRole({ circle: String(a.circle), role: String(a.role), motion }, deps),
  },
  'unseat-role': {
    op: 'circle:role:unseat',
    run: (a, motion, deps) => unseatRole({ circle: String(a.circle), role: String(a.role), motion }, deps),
  },
}

// Carries out what a passing motion decides, in its close's transaction
// after its verdict: each action, in the order proposed, an effect citing
// the close (`write` under `deps.effect`), its actor the member who
// closed it, judged by its guards. A refused one is rolled back and
// forgone, leaving the motion passed and that action undone, as its
// outcome says; the others still go. What reacts to each, an admission's
// subscription among them, is an effect citing it in turn. Whether the
// motion passed comes from its tally, which a secret ballot opens at its
// close.
export async function carried(motion: string, deps: Deps): Promise<Done[]> {
  const { rows } = await deps.db.query<{ n: number; kind: string; args: Args; circle: string }>(
    `SELECT m.n, m.kind, m.args, d.circle FROM motion.action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.motion = $1 AND d.closed IS NOT NULL AND coalesce((membership_motion.tally(d.id)).passes, false)
     ORDER BY m.n`,
    [motion],
  )
  const out: Done[] = []
  for (const m of rows) {
    const w = writes[m.kind]
    if (w) {
      out.push(done(w.op, await w.run(m.args, motion, deps, m.n, m.circle)))
    }
  }
  return out
}
