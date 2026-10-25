// The graft's reads and its slice, which the shell mounts: whose each
// statement is, by name, and the work share's terms read back on a
// member's page as what of it buys them shares. The split of each part
// between shares and cash is this graft's view, `split`, which the graft
// that credits the shares posts and checks.
import type { Slice } from '@cella/org-db'
import { named, statutes } from '../drivers/split.ts'

export { named, statutes } from '../drivers/split.ts'
export type { Named, Statutes } from '../models/split.ts'

export const slice: Slice = {
  name: 'account-membership-patronage',
  extends: {
    statements: { item: named },
    people: { item: (db) => statutes(db) },
  },
}
