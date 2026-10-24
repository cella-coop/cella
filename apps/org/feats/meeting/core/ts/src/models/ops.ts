import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a fact; a meeting's id is its circle and day, and a taken one is
  // refused
  'meeting:meeting:schedule': confluent({ power: 'schedule-meeting' }),
  // the agenda is registers: an item's place is its own, the last move
  // winning; fixed once the meeting is held
  'meeting:item:add': confluent({ check: 'seat' }),
  'meeting:item:move': confluent({ check: 'seat' }),
  'meeting:item:remove': confluent({ check: 'seat' }),
  // held or cancelled, never both: whichever settles first stands, and
  // holding fixes the agenda and who attended
  'meeting:meeting:hold': ordered({ power: 'keep-minutes' }),
  'meeting:meeting:cancel': ordered({ power: 'schedule-meeting' }),
  // idempotent: the first day the minutes were begun stands
  'meeting:meeting:minute': confluent({ power: 'keep-minutes' }),
} satisfies Ops
