import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact; a meeting's id is its circle and day, and a taken one is
  // refused
  'meeting:meeting:schedule': confluent({ power: 'schedule-meeting' }),
  // the agenda is registers: an item's place is its own, the last move
  // winning; fixed once the meeting is held
  'meeting:item:add': confluent({ power: 'discuss' }),
  'meeting:item:move': confluent({ power: 'discuss' }),
  'meeting:item:remove': confluent({ power: 'discuss' }),
  // held or cancelled, never both: whichever settles first stands, and
  // holding fixes the agenda and who attended
  'meeting:meeting:hold': ordered({ power: 'keep-minutes' }),
  'meeting:meeting:cancel': ordered({ power: 'schedule-meeting' }),
  // idempotent: the first day the minutes were begun stands
  'meeting:meeting:minute': confluent({ power: 'keep-minutes' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'meeting:body:save': confluent({ power: 'discuss' }),
} satisfies Actions
