// The feat's public writes, POST /api/project/<op> once the server exists,
// its reads, the form readers a graft reads the same forms with, and its
// slice, which the shell mounts, with projects imported from a spreadsheet.
import { action, type Slice } from '@cella/org-db'
import { add, archive, budget, complete, create, icon } from '../handlers/index.ts'
import { item, listing, offered, projects } from '../drivers/project.ts'
import { readers } from '../drivers/comment.ts'
import * as forms from './forms.ts'
import { projects as imported } from './imports.ts'
import { contract } from './contract.ts'
import { bodyActions, bodyMount, withBody } from './body.ts'
import { commentActions, inbox, withThreads } from './comments.ts'

export { add, archive, budget, complete, create, icon, slug } from '../handlers/index.ts'
export { item as project, offered, projects } from '../drivers/project.ts'
export * as forms from './forms.ts'
export { saveBody } from '../handlers/body.ts'
export { postComment, reactToComment, resolveComment } from '../handlers/comment.ts'

export const slice: Slice = {
  name: 'project',
  queries: contract,
  imports: { projects: imported },
  collections: {
    projects: {
      list: listing,
      about: offered,
      item: withThreads(withBody(item)),
      readers,
      index: async (db) => (await projects(db)).map((p) => ({ id: p.id, title: p.title, sub: p.circle ?? undefined })),
      body: bodyMount,
      actions: {
        ...commentActions,
        ...bodyActions,
        create: action('project:project:create', (form) => forms.create(form), create),
        milestone: action('project:milestone:add', (form, id) => forms.add(form, id ?? ''), add),
        complete: action('project:milestone:complete', (form, id) => forms.complete(form, id ?? ''), complete),
        budget: action('project:project:budget', (form, id) => forms.budget(form, id ?? ''), budget),
        archive: action('project:project:archive', (_, id) => ({ project: id ?? '' }), archive),
        icon: action('project:project:icon', (form, id) => forms.icon(form, id ?? ''), icon),
      },
    },
  },
  extends: {
    // The mentions waiting on the acting person, in their Inbox.
    inbox,
  },
}
