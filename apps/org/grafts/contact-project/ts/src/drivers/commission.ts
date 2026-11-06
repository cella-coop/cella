import type { Db } from '@cella/org-db'
import type { Commissioned, For } from '../models/commission.ts'

// The contact each project is for, by project.
export const contactOf = 'SELECT m.project AS id, c.name AS contact FROM contact_project.commission m JOIN contact.contact c ON c.id = m.contact'

export async function commissioner(db: Db, project: string): Promise<For> {
  const linked = await db.query<{ id: string; name: string }>(
    'SELECT c.id, c.name FROM contact_project.commission m JOIN contact.contact c ON c.id = m.contact WHERE m.project = $1',
    [project],
  )
  const all = await db.query<{ id: string; name: string }>(`SELECT id, name FROM contact.contact WHERE client IS NOT NULL AND NOT archived ORDER BY name`)
  return { contact: linked.rows[0] ?? null, contacts: all.rows }
}

// The projects a contact commissioned, the latest started first.
export async function commissioned(db: Db, contact: string): Promise<Commissioned[]> {
  const { rows } = await db.query<Omit<Commissioned, 'budget'> & { budget: string | null }>(
    `SELECT p.id, p.title, to_char(p.started, 'YYYY-MM-DD') AS started, to_char(p.due, 'YYYY-MM-DD') AS due,
            cella.cents(p.budget) AS budget
     FROM contact_project.commission m JOIN project.project p ON p.id = m.project
     WHERE m.contact = $1 ORDER BY p.started DESC, p.id`,
    [contact],
  )
  return rows.map((r) => ({ ...r, budget: r.budget === null ? null : Number(r.budget) }))
}
