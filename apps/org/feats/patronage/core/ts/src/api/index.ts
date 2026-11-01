// The feat's public writes, POST /api/patronage/<op> once the server
// exists, the write spec a graft composes, its reads, and its slice, which
// the shell mounts.
import { action, today, type Slice } from '@cella/org-db'
import { approve, draft } from '../handlers/index.ts'
import { distribution, distributions, years } from '../drivers/distribution.ts'
import { basis, bases } from '../drivers/terms.ts'
import { parts, statement, statements } from '../drivers/statement.ts'
import * as forms from './forms.ts'

export { adopt, approve, distributing, draft } from '../handlers/index.ts'
export { distribution, distributions } from '../drivers/distribution.ts'
export { basis, bases } from '../drivers/terms.ts'
export { statement, statements } from '../drivers/statement.ts'

// Each year's distribution and its split, the statutes' terms for the
// work share and each worker's statement; drafting a split, which finance
// prepares, and approving it, which cites the assembly's motion. Terms
// are copied from the rule a motion adopts, by `adopt`, which
// motion-patronage carries. Distributing a split posts it, so its
// write is patronage-transaction's.
export const slice: Slice = {
  name: 'patronage',
  collections: {
    distributions: {
      list: years,
      item: distribution,
      index: async (db) => (await distributions(db)).map((d) => ({ id: d.id, title: `${d.year} distribution`, sub: d.distributed ? 'distributed' : d.approved ? 'approved' : 'draft' })),
      // The year a new draft is for unless finance says otherwise: the last.
      about: async (db) => ({ year: Number((await today(db)).slice(0, 4)) - 1 }),
      actions: {
        draft: action('patronage:distribution:draft', (form) => forms.draft(form), draft),
        approve: action('patronage:distribution:approve', (form, id) => ({ distribution: id ?? '', motion: form.get('motion') }), approve),
      },
    },
    bases: {
      list: bases,
      item: basis,
    },
    statements: {
      list: parts,
      item: statement,
      index: async (db) => (await statements(db)).map((s) => ({ id: s.id, title: `${s.year} statement`, sub: s.worker })),
    },
  },
}
