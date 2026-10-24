import { ordered, type Ops } from '@cella/org-ops'

// Peers, other co-ops' notaries, arrive at rung 5 with their own writes.
export const ops = {
  // moving the co-op's notary to another server is an admin power
  'notary:notary:move': ordered(),
} satisfies Ops
