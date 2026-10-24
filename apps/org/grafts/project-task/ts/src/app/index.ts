import type { App } from '@cella/org-ui'
import type { Filed, Tasks as Listed } from '../models/filing.ts'
import Place from './blocks/Place.svelte'
import Tasks from './blocks/Tasks.svelte'

// The graft's client side: each task's project, a column a board may group
// by, and filing a task on its page; on a project's page, its own tab of
// tasks, a list long enough to crowd the overview, with a new task already
// in the project.
export const app: App = {
  name: 'project-task',
  extends: {
    tasks: {
      columns: [{ key: 'project', label: 'Project', kind: 'badge', role: 'hidden', value: (r: { project?: string }) => r.project }],
      page: {
        properties: (f: Filed) => [
          { label: 'Project', value: f.place?.title ?? 'none', href: f.place ? `/projects/${f.place.project}` : undefined },
          ...(f.place?.phase ? [{ label: 'Milestone', value: f.place.phase }] : []),
        ],
        related: (f: Filed) => (f.place ? [{ label: f.place.title, sub: 'project', href: `/projects/${f.place.project}` }] : []),
        blocks: [Place],
      },
    },
    projects: {
      columns: [{ key: 'tasks', label: 'Tasks done', role: 'hidden', value: (r: { tasks?: string }) => r.tasks ?? '0 / 0' }],
      page: {
        properties: (t: Listed) => [{ label: 'Tasks open', value: t.tasks.filter((x) => x.status !== 'done').length, kind: 'number' }],
        tabs: [{ id: 'tasks', label: 'Tasks' }],
        blocks: [{ tab: 'tasks', block: Tasks }],
      },
    },
  },
}
