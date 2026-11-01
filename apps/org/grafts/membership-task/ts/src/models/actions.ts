import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // the assignee is a register: the last writer wins; none unassigns
  'membership-task:task:assign': confluent({ power: 'edit-task' }),
} satisfies Actions

export interface Assign {
  task: string
  // An active member's address, or null to unassign.
  member: string | null
}
