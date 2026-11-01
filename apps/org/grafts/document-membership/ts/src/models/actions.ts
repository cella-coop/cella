import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact the member states of themselves; marking a version read again
  // changes nothing
  'document-membership:version:read': confluent({ check: 'self' }),
} satisfies Actions
