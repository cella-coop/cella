// The graft's reads and its slice, which the shell mounts: the motion
// approving a distribution, on the distribution's page, the motions
// moving to adopt the work share's terms, on the terms' page, and both on
// a motion's own; the drafted terms a new motion may move to adopt,
// and the drafted distributions it may move to approve.
// Approving and adopting cite the motion; both are the patronage feat's
// writes.
import type { Slice } from '@cella/org-db'
import { approvals, drafts } from '../drivers/approval.ts'
import { adoptions, drafted } from '../drivers/adoption.ts'

export { approvals, drafts } from '../drivers/approval.ts'
export { adoptions, drafted } from '../drivers/adoption.ts'
export type { Approval } from '../models/approval.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'motion-patronage',
  extends: {
    distributions: { item: (db, distribution) => approvals(db, { distribution }) },
    bases: { item: (db, terms) => adoptions(db, { terms }) },
    motions: {
      about: async (db) => ({ bases: await drafted(db), distributions: await drafts(db) }),
      item: async (db, motion) => ({ approvals: await approvals(db, { motion }), adoptions: await adoptions(db, { motion }) }),
    },
  },
}
