import { confluent, type Actions } from '@cella/org-actions'

export const actions = {
  // a fact, numbered by the server until rung 2 gives devices ids of their own
  'task:task:create': confluent({ power: 'edit-task' }),
  // the status is a register: the last writer wins
  'task:task:move': confluent({ power: 'edit-task' }),
  // the status register, set done with its day; the last writer wins
  'task:task:complete': confluent({ power: 'edit-task' }),
  // the priority and the due day are registers: the last writer wins
  'task:task:set': confluent({ power: 'edit-task' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it
  'task:body:save': confluent({ power: 'discuss' }),
  // a fact: comments are appended, each numbered by receipt
  'task:comment:post': confluent({ power: 'discuss' }),
  // resolving a root or reopening it is a register: the last writer wins
  'task:comment:resolve': confluent({ power: 'discuss' }),
  // a toggle: one reaction per comment, person and emoji, the last writer wins
  'task:comment:react': confluent({ power: 'discuss' }),
} satisfies Actions
