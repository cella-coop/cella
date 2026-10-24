import { confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // two offline nestings can form a cycle
  'circle:circle:nest': ordered(),
  // who holds which role
  'circle:position:add': ordered(),
  // who holds which role
  'circle:position:remove': ordered(),
  // authority, with limits such as maxAmount
  'circle:mandate:grant': ordered(),
  // authority, with limits such as maxAmount
  'circle:mandate:revoke': ordered(),
  // the circle's channel
  'circle:circle:message': confluent(),
} satisfies Ops
