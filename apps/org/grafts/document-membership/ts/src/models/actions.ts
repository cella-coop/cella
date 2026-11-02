import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact a person states of themselves; marking a version read again
  // changes nothing
  'document-membership:version:read': confluent({ power: 'mark-read' }),
} satisfies Actions
