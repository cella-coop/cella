import { ask, type Db, type Query } from '@cella/org-db'
import type { Filed, Listed, Tasks } from '../models/filing.ts'

// A place as a form's value: a project, or a project and a milestone.
export const place = (project: string, milestone?: number | null) => (milestone ? `${project}#${milestone}` : project)

// Each task's project, by task, which a board may group by.
export const projectOf = 'SELECT f.task AS id, p.title AS project FROM project_task.filing f JOIN project.project p ON p.id = f.project'

export async function filed(db: Db, task: string): Promise<Filed> {
  const { rows } = await db.query<{ project: string; title: string; milestone: number | null; phase: string | null }>(
    `SELECT f.project, p.title, f.milestone, m.title AS phase
     FROM project_task.filing f JOIN project.project p ON p.id = f.project
     LEFT JOIN project.milestone m ON m.project = f.project AND m.n = f.milestone
     WHERE f.task = $1`,
    [task],
  )
  const { rows: places } = await db.query<{ project: string; title: string; n: number | null; phase: string | null }>(
    `SELECT p.id AS project, p.title, m.n, m.title AS phase
     FROM project.project p LEFT JOIN project.milestone m ON m.project = p.id
     WHERE p.archived IS NULL ORDER BY p.title, m.n NULLS FIRST`,
  )
  const options = places.flatMap((r, i) => [
    ...(i === 0 || places[i - 1].project !== r.project ? [{ value: place(r.project), label: r.title }] : []),
    ...(r.n ? [{ value: place(r.project, r.n), label: `${r.title} · ${r.phase}` }] : []),
  ])
  return { place: rows[0] ?? null, options }
}

// A project's tasks, open ones first, as the view `project_task.tasks`
// reads them for its reader: a query the shell serves.
export const tasks: Query<Listed> = {
  view: 'project_task.tasks',
  by: ['project'],
  columns: ['id', 'title', 'status', 'priority', 'due', 'phase'],
  order: ['n'],
}

// A project's tasks, through the query, and its milestones.
export async function tasksOf(db: Db, project: string): Promise<Tasks> {
  const listed = await ask(db, tasks, { project })
  const { rows: milestones } = await db.query<{ n: number; title: string }>(
    'SELECT n, title FROM project.milestone WHERE project = $1 AND completed IS NULL ORDER BY n',
    [project],
  )
  const { rows: live } = await db.query<{ archived: boolean }>('SELECT archived IS NOT NULL AS archived FROM project.project WHERE id = $1', [project])
  return {
    tasks: listed,
    milestones: milestones.map((m) => ({ value: String(m.n), label: `${m.n}. ${m.title}` })),
    archived: live[0]?.archived ?? true,
  }
}

// How many of each project's tasks are done, by project, `0 / 0` where it
// has none.
export const counts = `SELECT p.id, coalesce(c.done, 0) || ' / ' || coalesce(c.tasks, 0) AS tasks
  FROM project.project p LEFT JOIN project_task.count c ON c.project = p.id`
