import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import * as register from '@cella/org-policy'
import type { actions } from '../models/actions.ts'
import type { Adopt, Adopted, End, Ended } from '../models/motion.ts'

// The adoption of the policy a passed motion carries, as a write a graft
// may extend in its transaction, as circle-motion does with the mandate a
// mandate policy grants: the register keeps it in the motion's circle with
// its wordings and its values, from the day the action names, or the
// verdict date, whichever is later, and its entry commits to the hash of
// its wordings, protected by the procedure it names, if any, taking the
// default it names, if any; a procedure policy makes its procedure.
// `motion.adopts` holds it to what the motion carries; that the motion
// passed is the guard of the graft that counts its roll.
export function adopting(input: Adopt): Write<Adopted> {
  return {
    op: 'motion:policy:adopt',
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
      const policy = await register.adopting(tx, {
        circle: found.circle,
        kind: args.kind as register.Kind,
        legal: args.wording,
        friendly: args.friendly ?? null,
        motion: input.motion,
        n: input.n,
        applies,
        until: args.until ?? null,
        replaces: args.replaces ?? null,
        protected: args.protected ?? null,
        takes: args.takes || null,
      })
      // A procedure policy's values are the procedure a motion is counted
      // by: copied into the feat's own row in this verdict.
      await tx.query('SELECT motion.procedure_from($1)', [policy])
      const hashed = await tx.query<{ hash: string }>(`SELECT encode(hash, 'hex') AS hash FROM policy.policy WHERE id = $1`, [policy])
      return { policy, motion: input.motion, n: input.n, applies, hash: hashed.rows[0].hash }
    },
    payload: (v) => ({ ...v }),
  }
}

export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof actions)['motion:policy:adopt'], Adopted>> {
  return write(deps, adopting(input))
}

// The end of the policy a passed motion's action `n` names, as a write a
// graft may extend, as circle-motion does with the mandate an ended
// mandate policy revokes: the register ends it on the verdict date, by
// that action. `motion.ends` holds it to what the motion carries.
export function ending(input: End): Write<Ended> {
  return {
    op: 'motion:policy:end',
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ policy: string }>(
        `SELECT m.args ->> 'policy' AS policy FROM motion.action m WHERE m.motion = $1 AND m.n = $2 AND m.kind = 'end'`,
        [input.motion, input.n],
      )
      const policy = rows[0]?.policy
      if (!policy) {
        return { policy: '', motion: input.motion, n: input.n, ends: '' }
      }
      const ends = await register.ending(tx, policy, input.motion, input.n)
      return { policy, motion: input.motion, n: input.n, ends }
    },
    payload: (v) => ({ ...v }),
  }
}

export async function end(input: End, deps: Deps): Promise<Outcome<(typeof actions)['motion:policy:end'], Ended>> {
  return write(deps, ending(input))
}
