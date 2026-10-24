import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // who holds which role
  'circle-member:position:add': ordered(),
  // who holds which role
  'circle-member:position:remove': ordered(),
} satisfies Ops
