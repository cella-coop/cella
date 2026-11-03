import type { Refused, Settled } from '@cella/org-actions'
import type { Deps } from '@cella/org-db'
import { propose } from './propose.ts'
import type { Proposed } from '@cella/org-motion/models'
import type { Asking } from '../models/asking.ts'

// Puts what a member's or a circle's page proposes to the circle that
// decides it, by the procedure its requirements fix: a membership to
// the assembly; a seat to another circle holding `seat-member`, or to the
// assembly (`circle_motion.decider`). The title says what is decided; the guards on the proposal check
// the action and that circle's say over it. Admitting, suspending or
// ending a membership, and giving or ending a seat, elect or remove a
// person, so they go to a secret ballot, as co-ops commonly do.
export async function put(input: Asking, deps: Deps): Promise<Settled<Proposed> | Refused> {
  const circle = input.kind === 'seat' || input.kind === 'unseat' ? String(input.args.circle) : null
  const { rows } = await deps.db.query<{ decider: string; member: string | null; circle: string | null; role: string | null }>(
    `SELECT d.id AS decider,
            (SELECT mp.name FROM person.person mp WHERE mp.address = $2) AS member,
            (SELECT c.name FROM circle.circle c WHERE c.id = $1) AS circle,
            (SELECT r.name FROM circle.role r WHERE r.id = $3) AS role
     FROM circle.circle d
     WHERE d.id = coalesce(circle_motion.decider($1, ARRAY['seat-member'], cella.verdict_date()), circle.assembly())`,
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
    exclude: `Exclude ${who}`,
    seat: `Seat ${who} in ${found.circle}${as}`,
    unseat: `End ${who}'s seat in ${found.circle}${as}`,
  }
  return propose(
    {
      circle: found.decider,
      title: titles[input.kind],
      ballot: 'secret',
      deadline: input.deadline,
      body: input.body,
      actions: [{ kind: input.kind, args: input.args }],
    },
    deps,
  )
}
