import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the last writer wins
  'client:client:add': confluent({ power: 'edit-client' }),
  // the last writer wins
  'client:client:update': confluent({ power: 'edit-client' }),
  // the last writer wins
  'client:client:archive': confluent({ power: 'edit-client' }),
} satisfies Ops
