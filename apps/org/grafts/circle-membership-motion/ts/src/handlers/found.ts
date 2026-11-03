import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Founded, Founding } from '../models/founding.ts'

const op = 'circle-membership-motion:scope:found' satisfies keyof typeof actions

// Founds a co-op, as the log's first entry, signed by a founder seated in
// its root: `circle_membership_motion.founds` lets it settle only on an
// empty log, as a form cella offers whose defaults its policies take,
// once its root can decide. The log keeps the form, where it came from
// and how many rows of each kind, never the rows.
export async function found(input: Founding, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Founded>> {
  return write(deps, {
    op,
    request: { form: input.form, from: input.from },
    state: async (tx) => ({ form: input.form, from: input.from, founded: await input.load(tx) }),
    payload: (v) => ({ ...v }),
  })
}
