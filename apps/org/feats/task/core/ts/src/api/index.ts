// The feat's public writes, POST /api/task/<op> once the server exists,
// the write spec and form readers a graft composes, its reads, and its
// slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { complete, create, move } from '../handlers/index.ts'
import { listing, task, tasks } from '../drivers/task.ts'
import * as forms from './forms.ts'

export { complete, create, creating, move } from '../handlers/index.ts'
export { task, tasks } from '../drivers/task.ts'
export * as forms from './forms.ts'

export const slice: Slice = {
  name: 'task',
  collections: {
    tasks: {
      list: listing,
      item: task,
      index: async (db) => (await tasks(db)).map((t) => ({ id: t.id, title: t.title, sub: `${t.id}, ${t.status}` })),
      actions: {
        create: action('task:task:create', (form) => forms.create(form), create),
        move: action('task:task:move', (form, id) => forms.move(form, id ?? ''), move),
        complete: action('task:task:complete', (_, id) => ({ task: id ?? '' }), complete),
      },
    },
  },
}
