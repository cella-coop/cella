// The graft's reads and its slice, which the shell mounts. It writes
// nothing: the proposal it fills in is circle-decision-membership's, put to
// the assembly from a member's page.
import type { Slice } from '@cella/org-db'
import { admission } from '../drivers/admission.ts'

export { admission } from '../drivers/admission.ts'

// On the page of someone invited after a probation, where their admission
// stands.
export const slice: Slice = {
  name: 'decision-employment-membership',
  extends: {
    people: { item: (db, member) => admission(db, member) },
  },
}
