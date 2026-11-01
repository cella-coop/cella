import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins
  'client:client:add': confluent({ power: 'edit-client' }),
  // the last writer wins
  'client:client:update': confluent({ power: 'edit-client' }),
  // the last writer wins
  'client:client:archive': confluent({ power: 'edit-client' }),
  // erasure wins over every update, whichever arrives first
  'client:client:erase': ordered({ power: 'erase-personal-data' }),
} satisfies Actions
