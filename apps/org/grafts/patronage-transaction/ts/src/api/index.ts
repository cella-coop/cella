// The graft's writes, reads and slice, which the shell mounts: a
// distribution distributed and posted in one write, which follows its
// approval, and the entry that posted it, on the distribution's page,
// with the Distribute button where the posting that followed was refused.
import { action, type Slice } from '@cella/org-db'
import { distribute, distributed } from '../handlers/distribute.ts'
import { posted } from '../drivers/posted.ts'
import { contract } from './contract.ts'

export { distribute, distributed } from '../handlers/distribute.ts'
export { posted } from '../drivers/posted.ts'
export type { Posted } from '../models/posted.ts'

export const slice: Slice = {
  name: 'patronage-transaction',
  queries: contract,
  extends: {
    distributions: {
      item: posted,
      actions: {
        distribute: action('patronage:distribution:distribute', (form, id) => ({ distribution: id ?? '', motion: form.get('motion') }), distribute),
      },
    },
  },
  on: {
    'patronage:distribution:approve': distributed,
  },
}
