import { bounded, confluent, ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // a member's own claim, a fact; two claims do no harm
  'expense:expense:capture': confluent({ check: 'self' }),
  // the member's own, and idempotent
  'expense:expense:submit': confluent({ check: 'self' }),
  // spends the approver's budget for the month, a right granted in advance
  // by their mandate; beyond it, refused
  'expense:expense:approve': bounded('budget', { power: 'approve-expense', amount: 'amount' }),
  // decides the expense against an approval: only one of the two stands
  'expense:expense:refuse': ordered({ power: 'approve-expense' }),
  // money leaves the bank, under its own power and limit; an expense is
  // reimbursed once
  'expense:expense:reimburse': ordered({ power: 'reimburse-expense', amount: 'amount' }),
} satisfies Ops
