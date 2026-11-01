import { bounded, type Actions } from '@cella/org-actions'

export const actions = {
  // spends the project's budget, a right set in advance: waits only when
  // what is left of it runs out
  'membership-project:project:share': bounded('budget', { power: 'set-budget', amount: 'amount' }),
} satisfies Actions

export interface Share {
  project: string
  member: string
  // In cents; the field a mandate's limit caps.
  amount: number
}
