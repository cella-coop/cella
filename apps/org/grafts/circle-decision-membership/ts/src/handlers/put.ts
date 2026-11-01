import type { Refused, Settled } from '@cella/org-actions'
import type { Deps } from '@cella/org-db'
import { propose } from './propose.ts'
import type { Proposed } from '@cella/org-decision/models'
import type { Asking } from '../models/asking.ts'

// Puts what a member's or a circle's page proposes to the circle that
// decides it, by that circle's procedure: a membership to the assembly; a
// seat to the circle above the one it is in, or to the assembly for its
// own. The title says what is decided; the guards on the proposal check
// the motion and that circle's say over it. Admitting, suspending or
// ending a membership, and giving or ending a seat, elect or remove a
// person, so they go to a secret ballot, as co-ops commonly do; an
// erasure goes by the procedure's.
export async function put(input: Asking, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const circle = input.kind === 'seat' || input.kind === 'unseat' ? String(input.args.circle) : null
  const { rows } = await deps.db.query<{ decider: string; procedure: string; member: string | null; circle: string | null; role: string | null }>(
    `SELECT d.id AS decider, d.procedure,
            (SELECT mp.name FROM membership.member m JOIN person.person mp ON mp.address = m.address WHERE m.address = $2) AS member,
            (SELECT c.name FROM circle.circle c WHERE c.id = $1) AS circle,
            (SELECT r.name FROM circle.role r WHERE r.id = $3) AS role
     FROM circle.circle d
     WHERE d.id = coalesce((SELECT coalesce(c.parent, c.id) FROM circle.circle c WHERE c.id = $1), (SELECT r.id FROM circle.circle r WHERE r.parent IS NULL))`,
    [circle, input.args.member ?? null, input.args.role ?? null],
  )
  const found = rows[0]
  if (!found) {
    throw new Error('no circle decides this: the co-op has no assembly')
  }
  const who = found.member ?? String(input.args.member)
  const as = found.role ? ` as ${found.role}` : ''
  const titles: Record<Asking['kind'], string> = {
    admit: `Admit ${who} as a member`,
    suspend: `Suspend ${who}`,
    exit: `End ${who}'s membership`,
    erase: `Erase ${who}'s personal data`,
    seat: `Seat ${who} in ${found.circle}${as}`,
    unseat: `End ${who}'s seat in ${found.circle}${as}`,
  }
  return propose(
    {
      circle: found.decider,
      title: titles[input.kind],
      procedure: found.procedure,
      ballot: input.kind === 'erase' ? undefined : 'secret',
      deadline: input.deadline,
      body: input.body,
      motions: [{ kind: input.kind, args: input.args }],
    },
    deps,
  )
}
