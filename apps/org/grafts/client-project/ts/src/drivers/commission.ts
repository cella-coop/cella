import type { Db } from '@cella/org-db'
import type { Commissioned, For } from '../models/commission.ts'

// The client each project is for, by project.
export async function clientOf(db: Db): Promise<Record<string, { client: string }>> {
  const { rows } = await db.query<{ project: string; name: string }>(
    'SELECT m.project, c.name FROM client_project.commission m JOIN client.client c ON c.id = m.client',
  )
  return Object.fromEntries(rows.map((r) => [r.project, { client: r.name }]))
}

export async function commissioner(db: Db, project: string): Promise<For> {
  const linked = await db.query<{ id: string; name: string }>(
    'SELECT c.id, c.name FROM client_project.commission m JOIN client.client c ON c.id = m.client WHERE m.project = $1',
    [project],
  )
  const all = await db.query<{ id: string; name: string }>(`SELECT id, name FROM client.client WHERE status <> 'archived' ORDER BY name`)
  return { client: linked.rows[0] ?? null, clients: all.rows }
}

// The projects a client commissioned, the latest started first.
export async function commissioned(db: Db, client: string): Promise<Commissioned[]> {
  const { rows } = await db.query<Omit<Commissioned, 'budget'> & { budget: string | null }>(
    `SELECT p.id, p.title, to_char(p.started, 'YYYY-MM-DD') AS started, to_char(p.due, 'YYYY-MM-DD') AS due,
            cella.cents(p.budget) AS budget
     FROM client_project.commission m JOIN project.project p ON p.id = m.project
     WHERE m.client = $1 ORDER BY p.started DESC, p.id`,
    [client],
  )
  return rows.map((r) => ({ ...r, budget: r.budget === null ? null : Number(r.budget) }))
}
