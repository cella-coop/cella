import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact the member states of themselves; marking a version read again
  // changes nothing
  'document-membership:version:read': confluent({ check: 'self' }),
} satisfies Ops
