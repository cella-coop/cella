import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // two nestings can form a cycle even online, so this orders already
  // at rung 1
  'circle:circle:nest': ordered({ power: 'organise-circles' }),
  // authority, capped by a limit per write or a budget over a period
  'circle:mandate:grant': ordered({ power: 'grant-mandate' }),
  // authority, capped by a limit per write or a budget over a period
  'circle:mandate:revoke': ordered({ power: 'grant-mandate' }),
  // the circle's channel, for those seated in it
  'circle:circle:message': confluent({ check: 'seat' }),
} satisfies Ops
