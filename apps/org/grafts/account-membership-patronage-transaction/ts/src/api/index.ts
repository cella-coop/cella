// The graft's reads and its slice, which the shell mounts: what a
// worker's part of the work share became, on their statement; a member's
// own statements, on their page; and a year's return to the federation,
// on the distribution's page. Employing the work share in shares is this
// graft's trigger, in the write that distributes.
import type { Slice } from '@cella/org-db'
import { employed, figures, owed } from '../drivers/patronage.ts'

export { employed, figures, owed } from '../drivers/patronage.ts'
export type { Employed, Figure, Movement, Owed } from '../models/patronage.ts'

export const slice: Slice = {
  name: 'account-membership-patronage-transaction',
  extends: {
    statements: { item: employed },
    distributions: { item: figures },
    people: { item: owed },
  },
}
