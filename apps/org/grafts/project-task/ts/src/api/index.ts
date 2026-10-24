// The graft's writes, POST /api/project-task/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Form, type Slice } from '@cella/org-db'
import { forms } from '@cella/org-task/api'
import { file, within } from '../handlers/file.ts'
import { counts, filed, projectOf, tasksOf } from '../drivers/filing.ts'
import type { File } from '../models/ops.ts'

export { file, within } from '../handlers/file.ts'
export { counts, filed, projectOf, tasksOf } from '../drivers/filing.ts'

// A place a form names: `project` or `project#milestone`.
function placed(form: Form, task: string): File {
  const [project, n] = form.get('place').split('#')
  if (!project) {
    throw new Error('a task is filed under a project')
  }
  return { task, project, milestone: n ? Number(n) : undefined }
}

// Where a task is filed, and filing it; a project's tasks, and a new task
// already in it.
export const slice: Slice = {
  name: 'project-task',
  extends: {
    tasks: {
      list: projectOf,
      item: filed,
      actions: {
        file: action('project-task:task:file', (form, id) => placed(form, id ?? ''), file),
      },
    },
    projects: {
      list: counts,
      item: tasksOf,
      actions: {
        task: action(
          'task:task:create',
          (form, id) => ({ ...forms.create(form), project: id ?? '', milestone: form.get('milestone') ? Number(form.get('milestone')) : undefined }),
          within,
        ),
      },
    },
  },
}
