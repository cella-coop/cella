import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // attendance is a register per member, the last mark winning; fixed
  // once the meeting is held
  'meeting-member:attendance:mark': confluent({ check: 'self' }),
  'meeting-member:attendance:record': confluent({ power: 'keep-minutes' }),
} satisfies Ops
