import { confluent, type Ops } from '@cella/org-ops'

export const ops = {
  // the assignee is a register: the last writer wins; none unassigns
  'membership-task:task:assign': confluent({ power: 'edit-task' }),
} satisfies Ops

export interface Assign {
  task: string
  // An active member's address, or null to unassign.
  member: string | null
}
