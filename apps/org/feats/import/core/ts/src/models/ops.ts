import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // the record of an import, the importer's own: a fact, and two commute
  'import:run:record': confluent({ check: 'self' }),
  // the state a scope holds from before its log, carried in once, as the
  // log's first entry
  'import:state:carry': ordered({ check: 'first' }),
} satisfies Ops
