// The graft's writes, reads and slice, which the shell mounts: what a
// worker's part of the work share became, on their statement; a member's
// own statements, on their page; and a year's return to the federation,
// on the distribution's page. What follows a distribution, each
// associate's part employed in shares, is this graft's reaction, a write
// of its own for each.
import type { Slice } from '@cella/org-db'
import { employed, figures, owed } from '../drivers/patronage.ts'
import { credited } from '../handlers/employ.ts'

export { employed, figures, owed } from '../drivers/patronage.ts'
export { credited, employ, employing } from '../handlers/employ.ts'
export type { Credited, Employ, Employed, Figure, Movement, Owed } from '../models/patronage.ts'

export const slice: Slice = {
  name: 'account-membership-patronage-transaction',
  extends: {
    statements: { item: employed },
    distributions: { item: figures },
    people: { item: owed },
  },
  on: {
    'patronage:distribution:distribute': credited,
  },
}
