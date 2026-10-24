import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // two nestings can form a cycle even online, so this orders already
  // at rung 1
  'circle:circle:nest': ordered(),
  // authority, capped by a limit per write or a budget over a period
  'circle:mandate:grant': ordered(),
  // authority, capped by a limit per write or a budget over a period
  'circle:mandate:revoke': ordered(),
  // the circle's channel
  'circle:circle:message': confluent(),
} satisfies Ops
