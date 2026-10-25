import { csv, type Importer } from '@cella/org-db'
import { create, slug } from '../handlers/index.ts'

// A day as YYYY-MM-DD, from that or DD/MM/YYYY.
const day = (typed: string) => {
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typed.trim())
  return fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : typed.trim()
}

// Projects from a spreadsheet or another tool's export, a CSV with the
// columns `title` (or `name`) and, if it has them, `circle`, `summary`
// (or `description`) and `due`: each created as the importing member,
// under their power to manage projects. A line is labelled by the
// project's id.
export const projects: Importer = {
  title: 'Projects',
  formats: 'CSV with the columns title, and circle, summary and due if it has them',
  read: async (text) =>
    csv(text).map(({ line, fields }) => {
      const title = (fields.title ?? fields.name ?? fields.Name ?? '').trim()
      if (!title) {
        return { line, label: `line ${line}`, op: 'project:project:create', refused: 'a project needs a title' }
      }
      const input = {
        title,
        circle: fields.circle || undefined,
        summary: fields.summary || fields.description || undefined,
        due: fields.due ? day(fields.due) : undefined,
      }
      return { line, label: slug(title), op: 'project:project:create', run: (deps) => create(input, deps) }
    }),
}
