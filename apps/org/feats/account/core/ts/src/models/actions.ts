import { bounded, confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // a member's draw on their own account, spending the draw limit granted
  // them in advance; beyond it, refused until the limit is raised
  'account:account:draw': bounded('limit', { check: 'self' }),
  // the members' motion adopts the statutes' capital clauses, once
  'account:terms:adopt': ordered({ decide: 'majority', check: 'decided' }),
  // the month after the latest the books hold, so entries dated in it
  // post; ordered against the next month's opening, which follows it
  'account:period:open': ordered({ power: 'close-period' }),
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
} satisfies Actions
