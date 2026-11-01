import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // attendance is a register per member, the last mark winning; fixed
  // once the meeting is held
  'meeting-membership:attendance:mark': confluent({ check: 'self' }),
  'meeting-membership:attendance:record': confluent({ power: 'keep-minutes' }),
} satisfies Actions
