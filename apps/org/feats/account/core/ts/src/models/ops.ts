import { bounded, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // from a member's share; beyond it, ordered
  'account:account:draw': bounded('share', { power: 'spend-circle' }),
  // the assembly's decision splits the surplus
  'account:surplus:allocate': ordered({ decide: 'majority', power: 'allocate-surplus' }),
  // nothing posts into a closed period
  'account:period:close': ordered({ power: 'close-period' }),
} satisfies Ops
