import type { Db } from '@cella/org-db'
import type { Detail, Milestone, Offered, Project } from '../models/project.ts'

const columns = `p.id, p.title, p.circle, to_char(p.started, 'YYYY-MM-DD') AS started, to_char(p.due, 'YYYY-MM-DD') AS due,
  cella.cents(p.budget) AS budget, g.milestones AS total, g.completed, g.next`

type Row = Omit<Project, 'budget' | 'state'> & { budget: string | null }

const project = (r: Row): Project => ({
  ...r,
  budget: r.budget === null ? null : Number(r.budget),
  state: r.total > 0 && r.completed === r.total ? 'done' : 'active',
})

// Every project not archived, the latest started first.
export async function projects(db: Db): Promise<Project[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${columns} FROM project.project p JOIN project.progress g ON g.id = p.id
     WHERE p.archived IS NULL ORDER BY p.started DESC, p.id`,
  )
  return rows.map(project)
}

// A project with its summary and milestones, archived or not.
export async function item(db: Db, id: string): Promise<Detail | null> {
  const { rows } = await db.query<Row & { summary: string; archived: string | null }>(
    `SELECT ${columns}, p.summary, to_char(p.archived, 'YYYY-MM-DD') AS archived
     FROM project.project p JOIN project.progress g ON g.id = p.id WHERE p.id = $1`,
    [id],
  )
  if (!rows[0]) {
    return null
  }
  const { rows: milestones } = await db.query<Milestone>(
    `SELECT n::text AS id, n, title, to_char(due, 'YYYY-MM-DD') AS due, to_char(completed, 'YYYY-MM-DD') AS completed
     FROM project.milestone WHERE project = $1 ORDER BY n`,
    [id],
  )
  return { ...project(rows[0]), summary: rows[0].summary, archived: rows[0].archived, milestones }
}

export async function offered(db: Db): Promise<Offered> {
  const { rows } = await db.query<{ circle: string }>('SELECT DISTINCT circle FROM project.project WHERE circle IS NOT NULL ORDER BY circle')
  return { circles: rows.map((r) => r.circle) }
}
