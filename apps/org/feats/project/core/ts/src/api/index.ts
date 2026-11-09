// The feat's public writes, POST /api/project/<op> once the server exists,
// its reads, the form readers a graft reads the same forms with, and its
// slice, which the shell mounts, with projects imported from a spreadsheet.
import { action, type Slice } from '@cella/org-db'
import { add, archive, budget, complete, create } from '../handlers/index.ts'
import { item, listing, offered, projects } from '../drivers/project.ts'
import * as forms from './forms.ts'
import { projects as imported } from './imports.ts'
import { contract } from './contract.ts'

export { add, archive, budget, complete, create, slug } from '../handlers/index.ts'
export { item as project, offered, projects } from '../drivers/project.ts'
export * as forms from './forms.ts'

export const slice: Slice = {
  name: 'project',
  queries: contract,
  imports: { projects: imported },
  collections: {
    projects: {
      list: listing,
      about: offered,
      item,
      index: async (db) => (await projects(db)).map((p) => ({ id: p.id, title: p.title, sub: p.circle ?? undefined })),
      actions: {
        create: action('project:project:create', (form) => forms.create(form), create),
        milestone: action('project:milestone:add', (form, id) => forms.add(form, id ?? ''), add),
        complete: action('project:milestone:complete', (form, id) => forms.complete(form, id ?? ''), complete),
        budget: action('project:project:budget', (form, id) => forms.budget(form, id ?? ''), budget),
        archive: action('project:project:archive', (_, id) => ({ project: id ?? '' }), archive),
      },
    },
  },
}
