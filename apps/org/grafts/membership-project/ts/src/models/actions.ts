import { bounded, confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // spends the project's budget, a right set in advance: waits only when
  // what is left of it runs out
  'membership-project:project:share': bounded('budget', { power: 'set-budget', amount: 'amount' }),
  // the last crew written stands, Linear's lead and members, independent
  // of who edits the project
  'membership-project:project:crew': confluent({ power: 'manage-project' }),
} satisfies Actions

export interface Share {
  project: string
  member: string
  // In cents; the field a mandate's limit caps.
  amount: number
}

export interface Crew {
  project: string
  // An address, or none to leave the project led by no one.
  lead: string | null
  members: string[]
}
