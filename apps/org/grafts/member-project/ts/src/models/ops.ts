import { bounded, type Ops } from '@cella/org-ops'

export const ops = {
  // spends the project's budget, a right set in advance: waits only when
  // what is left of it runs out
  'member-project:project:share': bounded('budget', { power: 'set-budget', amount: 'amount' }),
} satisfies Ops

export interface Share {
  project: string
  member: string
  // In cents; the field a mandate's limit caps.
  amount: number
}
