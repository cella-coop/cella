import { bounded, confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // an employee's own claim, by their right; a fact, two claims do no harm
  'expense:expense:capture': confluent({ power: 'claim-expense' }),
  // the employee's own, by their right, and idempotent
  'expense:expense:submit': confluent({ power: 'claim-expense' }),
  // spends the approver's budget for the month, a right granted in advance
  // by their mandate; beyond it, refused
  'expense:expense:approve': bounded('budget', { power: 'approve-expense', amount: 'amount' }),
  // decides the expense against an approval: only one of the two stands
  'expense:expense:refuse': ordered({ power: 'approve-expense' }),
  // money leaves the bank, under its own power and limit; an expense is
  // reimbursed once
  'expense:expense:reimburse': ordered({ power: 'reimburse-expense', amount: 'amount' }),
} satisfies Actions
