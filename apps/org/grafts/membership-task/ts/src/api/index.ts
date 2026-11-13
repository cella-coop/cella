// The graft's writes, POST /api/membership-task/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { assign } from '../handlers/assign.ts'
import { assigned, assignees, doing } from '../drivers/assignment.ts'
import { contract } from './contract.ts'

export { assign } from '../handlers/assign.ts'
export { assigned, assignees, doing } from '../drivers/assignment.ts'

// Who does a task, and giving it to someone; what a member is doing.
export const slice: Slice = {
  name: 'membership-task',
  queries: contract,
  extends: {
    tasks: {
      list: assignees,
      item: assigned,
      actions: {
        assign: action('membership-task:task:assign', (form, id) => ({ task: id ?? '', member: form.get('member') || null }), assign),
      },
    },
    people: {
      item: doing,
    },
  },
}
