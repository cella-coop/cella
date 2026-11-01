import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a new file is a fact, the uploader's own; two uploads commute
  'file:file:upload': confluent({ check: 'self' }),
} satisfies Actions
