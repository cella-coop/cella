import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // the last writer wins
  'contact:contact:add': confluent({ power: 'edit-contact' }),
  // the last writer wins
  'contact:contact:update': confluent({ power: 'edit-contact' }),
  // the last writer wins
  'contact:contact:archive': confluent({ power: 'edit-contact' }),
  // erasure wins over every update, whichever arrives first
  'contact:contact:erase': ordered({ power: 'erase-personal-data' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'contact:body:save': confluent({ power: 'discuss' }),
} satisfies Actions
