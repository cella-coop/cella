import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // who holds which role; a seat is given by the decision it cites, such
  // as the admission that seats a new member in the assembly
  'circle-member:position:add': ordered({ check: 'decided' }),
  // who holds which role
  'circle-member:position:remove': ordered(),
} satisfies Ops
