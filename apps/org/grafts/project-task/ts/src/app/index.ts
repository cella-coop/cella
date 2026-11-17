import type { App } from '@cella/org-ui'
import type { Filed, Tasks as Listed } from '../models/filing.ts'
import Tasks from './blocks/Tasks.svelte'

// The graft's client side: each task's project, a column a board may group
// by, and filing a task by a popover on its property; on a project's page, the
// Tasks tab its owner gives it, a list long enough to crowd the overview,
// with a new task already in the project.
export const app: App = {
  name: 'project-task',
  extends: {
    tasks: {
      columns: [
        { key: 'project', label: 'Project', kind: 'badge', role: 'hidden', record: 'projects', value: (r: { project?: string }) => r.project },
        { key: 'project_id', label: 'Project id', kind: 'mono', role: 'hidden', of: 'projects', value: (r: { project_id?: string }) => r.project_id },
      ],
      page: {
        properties: (f: Filed) => [
          {
            label: 'Project',
            value: f.place?.title ?? null,
            href: f.place ? `/projects/${f.place.project}` : undefined,
            edit: {
              kind: 'pick' as const,
              write: 'file',
              field: 'place',
              current: f.place ? (f.place.milestone ? `${f.place.project}#${f.place.milestone}` : f.place.project) : '',
              options: f.options,
            },
          },
          ...(f.place?.phase ? [{ label: 'Milestone', value: f.place.phase }] : []),
        ],
        related: (f: Filed) => (f.place ? [{ label: f.place.title, sub: 'project', href: `/projects/${f.place.project}` }] : []),
      },
    },
    projects: {
      columns: [{ key: 'tasks', label: 'Tasks done', role: 'hidden', value: (r: { tasks: string }) => r.tasks }],
      page: {
        properties: (t: Listed) => [{ label: 'Tasks open', value: t.tasks.filter((x) => x.status !== 'done').length, kind: 'number' }],
        blocks: [{ tab: 'tasks', block: Tasks }],
      },
    },
  },
}
