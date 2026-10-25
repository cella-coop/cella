// The feat's public writes, POST /api/patronage/<op> once the server
// exists, the write spec a graft composes, its reads, and its slice, which
// the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { adopt, approve } from '../handlers/index.ts'
import { distribution, distributions } from '../drivers/distribution.ts'
import { basis, bases } from '../drivers/terms.ts'
import { statement, statements } from '../drivers/statement.ts'

export { adopt, approve, distributing } from '../handlers/index.ts'
export { distribution, distributions } from '../drivers/distribution.ts'
export { basis, bases } from '../drivers/terms.ts'
export { statement, statements } from '../drivers/statement.ts'

// Each year's distribution and its split, the statutes' terms for the
// work share and each worker's statement; approving a split and adopting
// terms, which cite the assembly's decision. Distributing a split posts
// it, so its write is patronage-transaction's.
export const slice: Slice = {
  name: 'patronage',
  collections: {
    distributions: {
      list: distributions,
      item: distribution,
      index: async (db) => (await distributions(db)).map((d) => ({ id: d.id, title: `${d.year} distribution`, sub: d.distributed ? 'distributed' : d.approved ? 'approved' : 'draft' })),
      actions: {
        approve: action('patronage:distribution:approve', (form, id) => ({ distribution: id ?? '', decision: form.get('decision') }), approve),
      },
    },
    bases: {
      list: bases,
      item: basis,
      actions: {
        adopt: action('patronage:terms:adopt', (form, id) => ({ terms: id ?? '', decision: form.get('decision') }), adopt),
      },
    },
    statements: {
      list: statements,
      item: statement,
      index: async (db) => (await statements(db)).map((s) => ({ id: s.id, title: `${s.year} statement`, sub: s.worker })),
    },
  },
}
