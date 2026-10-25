import { csv, type Importer } from '@cella/org-db'
import { create } from '@cella/org-task/api'
import { priorities, statuses, type Priority, type Status } from '@cella/org-task/models'
import { within } from '../handlers/file.ts'

// A day as YYYY-MM-DD, from that or DD/MM/YYYY.
const day = (typed: string) => {
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typed.trim())
  return fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : typed.trim()
}

// Tasks from a spreadsheet or another tool's export, a CSV with the
// columns `title` (or `Name`, as Asana's export names it), and if it has
// them `project` (a project's title or id; Asana's `Projects`),
// `priority`, `status` and `due` (Asana's `Due Date`). Each is created as
// the importing member, under their power to edit tasks, in the project
// it names, or in none. A task done before the switch is not carried
// over, and says so. A line is labelled by its title.
export const tasks: Importer = {
  title: 'Tasks',
  formats: 'CSV with the columns title, and project, priority, status and due if it has them; Asana’s task export reads too',
  read: async (text, db) => {
    const { rows: projects } = await db.query<{ id: string; title: string }>('SELECT id, title FROM project.project WHERE archived IS NULL')
    return csv(text).map(({ line, fields }) => {
      const title = (fields.title ?? fields.Name ?? '').trim()
      // Asana lists a task's projects with a comma between them, and a
      // title may hold one: the whole first, then its first part.
      const named = (fields.project ?? fields.Projects ?? '').trim().toLowerCase()
      const find = (n: string) => projects.find((p) => p.id === n || p.title.trim().toLowerCase() === n)
      const project = find(named) ?? find(named.split(',')[0].trim())
      const status = (fields.status ?? '').toLowerCase()
      const done = status === 'done' || Boolean(fields['Completed At'])
      const op = 'task:task:create'
      if (!title) {
        return { line, label: `line ${line}`, op, refused: 'a task needs a title' }
      }
      if (done) {
        return { line, label: title, op, refused: 'it was done before the switch' }
      }
      if (named && !project) {
        return { line, label: title, op, refused: `the co-op has no project ${named}` }
      }
      const task = {
        title,
        priority: (priorities as readonly string[]).includes(fields.priority ?? '') ? (fields.priority as Priority) : undefined,
        status: (statuses as readonly string[]).includes(status) ? (status as Exclude<Status, 'done'>) : undefined,
        due: (fields.due ?? fields['Due Date']) ? day(fields.due ?? fields['Due Date']) : undefined,
      }
      return { line, label: title, op, run: (deps) => (project ? within({ ...task, project: project.id }, deps) : create(task, deps)) }
    })
  },
}
