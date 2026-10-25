import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the record of an import, the importer's own: a fact, and two commute
  'import:run:record': confluent({ check: 'self' }),
} satisfies Ops
