import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact, numbered by the server until rung 2 gives devices ids of their own
  'task:task:create': confluent({ power: 'edit-task' }),
  // the status is a register: the last writer wins
  'task:task:move': confluent({ power: 'edit-task' }),
  // the status register, set done with its day; the last writer wins
  'task:task:complete': confluent({ power: 'edit-task' }),
} satisfies Actions
