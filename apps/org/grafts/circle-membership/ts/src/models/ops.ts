import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // who holds which role; a seat is given by the decision it cites, such
  // as the admission that seats a new member in the assembly
  'circle-membership:position:add': ordered({ check: 'decided' }),
  // who holds which role; a seat is ended by the decision it cites
  'circle-membership:position:remove': ordered({ check: 'decided' }),
} satisfies Ops
