// The graft's reads and its slice, which the shell mounts: what a motion
// asks of members, on the motion's page and the member's, and the
// members its discussion names, and the mentions waiting on a member.
import type { Slice } from '@cella/org-db'
import { asked, people } from '../drivers/admission.ts'
import { mentions } from '../drivers/inbox.ts'

export { asked, people } from '../drivers/admission.ts'
export { mentions } from '../drivers/inbox.ts'
export type { Asked, Kind, OnMotion, People } from '../models/admission.ts'

export const slice: Slice = {
  name: 'membership-motion',
  extends: {
    motions: { item: async (db, motion) => ({ asked: await asked(db, { motion }), people: await people(db, motion) }) },
    people: { item: (db, member) => asked(db, { member }) },
    // The mentions waiting on the acting member, in their inbox.
    inbox: { rows: mentions },
  },
}
