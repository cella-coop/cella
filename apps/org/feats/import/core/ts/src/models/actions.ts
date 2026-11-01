import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the record of an import, the importer's own: a fact, and two commute
  'import:run:record': confluent({ power: 'record-import' }),
} satisfies Actions
