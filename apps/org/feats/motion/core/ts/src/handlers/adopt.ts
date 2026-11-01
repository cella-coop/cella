import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { adopting, type Kind } from '@cella/org-policy'
import type { actions } from '../models/actions.ts'
import type { Adopt, Adopted } from '../models/motion.ts'

const op = 'motion:policy:adopt'

// Adopts the policy a passed motion carries, as its own decided write: the
// register keeps it in the motion's circle with its wordings and its
// values, from the day the action names, or the verdict date, whichever is
// later, and its entry commits to the hash of its wordings. `motion.adopts`
// holds it to what the motion carries; that the motion passed is the
// guard of the graft that counts its roll.
export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Adopted>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ circle: string; args: Record<string, string>; today: string }>(
        `SELECT d.circle, m.args, to_char(cella.verdict_date(), 'YYYY-MM-DD') AS today
         FROM motion.action m JOIN motion.motion d ON d.id = m.motion
         WHERE m.motion = $1 AND m.n = $2 AND m.kind = 'policy'`,
        [input.motion, input.n],
      )
      const found = rows[0]
      if (!found) {
        return { policy: '', motion: input.motion, n: input.n, applies: '', hash: '' }
      }
      const { args, today } = found
      const applies = args.from && args.from > today ? args.from : today
      const policy = await adopting(tx, {
        circle: found.circle,
        kind: args.kind as Kind,
        legal: args.wording,
        friendly: args.friendly ?? null,
        motion: input.motion,
        n: input.n,
        applies,
        until: args.until ?? null,
        replaces: args.replaces ?? null,
      })
      const hashed = await tx.query<{ hash: string }>(`SELECT encode(hash, 'hex') AS hash FROM policy.policy WHERE id = $1`, [policy])
      return { policy, motion: input.motion, n: input.n, applies, hash: hashed.rows[0].hash }
    },
    payload: (v) => ({ ...v }),
  })
}
