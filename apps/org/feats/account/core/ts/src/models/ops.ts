import { bounded, confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a member's draw on their own account, spending the draw limit granted
  // them in advance; beyond it, refused until the limit is raised
  'account:account:draw': bounded('limit', { check: 'self' }),
  // the assembly's decision splits the surplus, once
  'account:surplus:allocate': ordered({ decide: 'majority', check: 'decided' }),
  // the members' decision adopts the statutes' terms, once
  'account:terms:adopt': ordered({ decide: 'majority', check: 'decided' }),
  // nothing posts into a closed period
  'account:period:close': ordered({ power: 'close-period' }),
  // money an associate pays in on their subscription, a deposit: entries
  // commute, and what is left to pay is the sum of them
  'account:capital:pay': confluent({ power: 'record-receipt' }),
  // an associate spreads what they owe on their subscription over monthly
  // instalments from their pay: their own register, the latest standing
  'account:capital:spread': confluent({ check: 'self' }),
  // a departed associate's capital repaid, instalment by instalment, each
  // once and in its turn
  'account:capital:repay': ordered({ power: 'repay-capital' }),
} satisfies Ops
