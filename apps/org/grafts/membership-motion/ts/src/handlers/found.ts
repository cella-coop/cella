import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Founded, Founding } from '../models/founding.ts'

const op = 'membership-motion:scope:found' satisfies keyof typeof actions

// Founds a coop, as the log's first entry, signed by a founder seated in
// its root: `membership_motion.founds` lets it settle only on an
// empty log, as a form cella offers whose defaults its policies take,
// once its root can decide, by a founding motion of the root its
// founders, each seated there with a vote, decided. The log keeps the
// form, the motion, where it came from, how many rows of each kind, and
// the rows themselves as `cella.carry` reads them once they are in, each
// personal value as its commitment, so the fold applies them to an empty
// database before any other entry.
export async function found(input: Founding, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Founded>> {
  return write(deps, {
    op,
    request: { form: input.form, motion: input.motion, from: input.from },
    state: async (tx) => {
      const founded = await input.load(tx)
      const { rows } = await tx.query<{ carried: Founded['carried'] }>('SELECT cella.carry() AS carried')
      return { form: input.form, motion: input.motion, from: input.from, founded, carried: rows[0].carried }
    },
    payload: (v) => ({ ...v }),
  })
}
