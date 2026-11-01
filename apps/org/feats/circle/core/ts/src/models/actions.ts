import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // two nestings can form a cycle even online, so this orders already
  // at rung 1; the cited motion nests the circle
  'circle:circle:nest': ordered({ check: 'decided' }),
  // authority, capped by a limit per write or a budget over a period;
  // the cited motion grants it
  'circle:mandate:grant': ordered({ check: 'decided' }),
  // authority, capped by a limit per write or a budget over a period;
  // the cited motion revokes it
  'circle:mandate:revoke': ordered({ check: 'decided' }),
  // the circle's channel, for those seated in it
  'circle:circle:message': confluent({ check: 'seat' }),
} satisfies Actions
