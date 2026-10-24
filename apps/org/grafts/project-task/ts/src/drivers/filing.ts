import type { Db } from '@cella/org-db'
import type { Filed, Listed, Tasks } from '../models/filing.ts'

// A place as a form's value: a project, or a project and a milestone.
export const place = (project: string, milestone?: number | null) => (milestone ? `${project}#${milestone}` : project)

// Each task's project, by task, which a board may group by.
export async function projectOf(db: Db): Promise<Record<string, { project: string }>> {
  const { rows } = await db.query<{ task: string; title: string }>(
    'SELECT f.task, p.title FROM project_task.filing f JOIN project.project p ON p.id = f.project',
  )
  return Object.fromEntries(rows.map((r) => [r.task, { project: r.title }]))
}

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

// A project's tasks, open ones first, and its milestones.
export async function tasksOf(db: Db, project: string): Promise<Tasks> {
  const { rows: tasks } = await db.query<Listed>(
    `SELECT t.id, t.title, t.status, t.priority, to_char(t.due, 'YYYY-MM-DD') AS due, m.title AS phase
     FROM project_task.filing f JOIN task.task t ON t.id = f.task
     LEFT JOIN project.milestone m ON m.project = f.project AND m.n = f.milestone
     WHERE f.project = $1
     ORDER BY t.status = 'done', array_position(ARRAY['urgent', 'high', 'normal', 'low'], t.priority), t.due NULLS LAST, t.id`,
    [project],
  )
  const { rows: milestones } = await db.query<{ n: number; title: string }>(
    'SELECT n, title FROM project.milestone WHERE project = $1 AND completed IS NULL ORDER BY n',
    [project],
  )
  const { rows: live } = await db.query<{ archived: boolean }>('SELECT archived IS NOT NULL AS archived FROM project.project WHERE id = $1', [project])
  return {
    tasks,
    milestones: milestones.map((m) => ({ value: String(m.n), label: `${m.n}. ${m.title}` })),
    archived: live[0]?.archived ?? true,
  }
}

// How many of each project's tasks are done, by project.
export async function counts(db: Db): Promise<Record<string, { tasks: string }>> {
  const { rows } = await db.query<{ project: string; tasks: number; done: number }>('SELECT project, tasks, done FROM project_task.count')
  return Object.fromEntries(rows.map((r) => [r.project, { tasks: `${r.done} / ${r.tasks}` }]))
}
