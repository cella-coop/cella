// The graft's writes, reads and slice, which the shell mounts: a
// distribution distributed and posted in one write, and the entry that
// posted it, on the distribution's page.
import { action, type Slice } from '@cella/org-db'
import { distribute } from '../handlers/distribute.ts'
import { posted } from '../drivers/posted.ts'

export { distribute } from '../handlers/distribute.ts'
export { posted } from '../drivers/posted.ts'
export type { Posted } from '../models/posted.ts'

export const slice: Slice = {
  name: 'patronage-transaction',
  extends: {
    distributions: {
      item: posted,
      actions: {
        distribute: action('patronage:distribution:distribute', (_, id) => ({ distribution: id ?? '' }), distribute),
      },
    },
  },
}
