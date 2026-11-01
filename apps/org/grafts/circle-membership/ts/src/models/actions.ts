import { ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // who holds which role; a seat is given by the motion it cites, such
  // as the admission that seats a new member in the assembly
  'circle-membership:seat:add': ordered({ check: 'decided' }),
  // who holds which role; a seat is ended by the motion it cites
  'circle-membership:seat:remove': ordered({ check: 'decided' }),
} satisfies Actions
