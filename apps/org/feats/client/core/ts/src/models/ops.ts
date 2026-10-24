import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the last writer wins
  'client:client:add': confluent(),
  // the last writer wins
  'client:client:update': confluent(),
  // the last writer wins
  'client:client:archive': confluent(),
} satisfies Ops
