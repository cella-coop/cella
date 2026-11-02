// The graft's reads, its reaction and its slice, which the shell mounts:
// the motion approving a distribution, on the distribution's page, the
// motion that adopted the rule each terms copy, on the terms' page, and
// both on a motion's own; the drafted distributions a new motion may move
// to approve; and, once a motion adopts a work share rule, its values
// copied into terms by the patronage feat's write that follows the
// adoption. Approving and adopting cite the motion; both are the
// patronage feat's writes.
import type { Slice } from '@cella/org-db'
import { approvals, drafts } from '../drivers/approval.ts'
import { adoptions } from '../drivers/adoption.ts'
import { adopted } from '../handlers/terms.ts'

export { approvals, drafts } from '../drivers/approval.ts'
export { adoptions } from '../drivers/adoption.ts'
export { adopted } from '../handlers/terms.ts'
export type { Approval } from '../models/approval.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'motion-patronage',
  extends: {
    distributions: { item: (db, distribution) => approvals(db, { distribution }) },
    bases: { item: (db, terms) => adoptions(db, { terms }) },
    motions: {
      about: async (db) => ({ distributions: await drafts(db) }),
      item: async (db, motion) => ({ approvals: await approvals(db, { motion }), adoptions: await adoptions(db, { motion }) }),
    },
  },
  on: {
    'motion:policy:adopt': adopted,
  },
}
