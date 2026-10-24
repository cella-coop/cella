// The graft's reads and its slice, which the shell mounts: whom a decision
// admits, on the decision's page and the member's.
import type { Slice } from '@cella/org-db'
import { admissions } from '../drivers/admission.ts'

export { admissions } from '../drivers/admission.ts'
export type { Admission } from '../models/admission.ts'

export const slice: Slice = {
  name: 'decision-member',
  extends: {
    decisions: { item: (db, decision) => admissions(db, { decision }) },
    members: { item: (db, member) => admissions(db, { member }) },
  },
}
