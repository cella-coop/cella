import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a record of one's own, invited or a member: a fact, two filed commute
  'file-membership:member:attach': confluent({ power: 'file-record' }),
} satisfies Actions
