import { bounded, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a member's draw on their own account, spending the draw limit granted
  // them in advance; beyond it, refused until the limit is raised
  'account:account:draw': bounded('limit', { check: 'self' }),
  // the assembly's decision splits the surplus, once
  'account:surplus:allocate': ordered({ decide: 'majority', check: 'decided' }),
  // the members' decision adopts the work share's terms, once
  'account:terms:adopt': ordered({ decide: 'majority', check: 'decided' }),
  // nothing posts into a closed period
  'account:period:close': ordered({ power: 'close-period' }),
} satisfies Ops
