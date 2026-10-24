// The graft's reads and its slice, which the shell mounts: what a decision
// asks of members, on the decision's page and the member's.
import type { Slice } from '@cella/org-db'
import { asked } from '../drivers/admission.ts'

export { asked } from '../drivers/admission.ts'
export type { Asked, Kind } from '../models/admission.ts'

export const slice: Slice = {
  name: 'decision-member',
  extends: {
    decisions: { item: (db, decision) => asked(db, { decision }) },
    members: { item: (db, member) => asked(db, { member }) },
  },
}
