// The graft's reads, its reaction and its slice, which the shell mounts:
// the motion that adopted the rule each capital terms copy, on the terms'
// page, and the terms a motion's rules made, on its own; and, once a
// motion adopts a capital rule, its values copied into terms by the
// account feat's write that follows the adoption.
import type { Slice } from '@cella/org-db'
import { adoptions } from '../drivers/adoption.ts'
import { adopted } from '../handlers/terms.ts'

export { adoptions } from '../drivers/adoption.ts'
export { adopted } from '../handlers/terms.ts'
export type { Adoption } from '../models/adoption.ts'

export const slice: Slice = {
  name: 'account-motion',
  extends: {
    terms: { item: (db, terms) => adoptions(db, { terms }) },
    motions: { item: (db, motion) => adoptions(db, { motion }) },
  },
  on: {
    'motion:policy:adopt': adopted,
  },
}
