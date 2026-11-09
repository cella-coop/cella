// The feat's public writes, POST /api/task/<op> once the server exists,
// the write spec and form readers a graft composes, its reads, and its
// slice, which the shell mounts, its bodies handed to core body's session
// and the mentions waiting on a person to their Inbox.
import { action, type Slice } from '@cella/org-db'
import { complete, create, move, post, resolve, save } from '../handlers/index.ts'
import { circleOf, listing, page, saved, tasks } from '../drivers/task.ts'
import { mentions } from '../drivers/comment.ts'
import * as forms from './forms.ts'
import { contract } from './contract.ts'

export { complete, create, creating, move, post, resolve, save } from '../handlers/index.ts'
export { task, tasks } from '../drivers/task.ts'
export { comments, mentions } from '../drivers/comment.ts'
export * as forms from './forms.ts'

export const slice: Slice = {
  name: 'task',
  queries: contract,
  collections: {
    tasks: {
      list: listing,
      item: page,
      index: async (db) => (await tasks(db)).map((t) => ({ id: t.id, title: t.title, sub: `${t.id}, ${t.status}` })),
      actions: {
        create: action('task:task:create', (form) => forms.create(form), create),
        move: action('task:task:move', (form, id) => forms.move(form, id ?? ''), move),
        complete: action('task:task:complete', (_, id) => ({ task: id ?? '' }), complete),
        save: action('task:body:save', (form, id) => forms.save(form, id ?? ''), save),
        post: action('task:comment:post', (form, id) => forms.post(form, id ?? ''), post),
        resolve: action('task:comment:resolve', (form) => forms.resolve(form), resolve),
      },
      body: { circle: circleOf, saved, save: 'save' },
    },
  },
  extends: {
    // The mentions waiting on the acting person, in their Inbox.
    inbox: { rows: mentions },
  },
}
