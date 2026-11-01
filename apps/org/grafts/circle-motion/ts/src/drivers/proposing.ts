import type { Db } from '@cella/org-db'
import { inForce } from '@cella/org-policy'
import type { Deciding, Proposing } from '../models/index.ts'

// Every circle, in tree order, with the procedure its motions follow.
export async function deciding(db: Db): Promise<Deciding[]> {
  const { rows } = await db.query<Deciding>('SELECT id, name, procedure FROM circle.circle ORDER BY path')
  return rows
}

// What a circle's page offers to propose about it, and the policies it
// has adopted that are in force.
export async function proposing(db: Db, circle: string): Promise<Proposing | null> {
  const found = await db.query<{ decider: Deciding }>(
    `SELECT json_build_object('id', d.id, 'name', d.name, 'procedure', d.procedure) AS decider
     FROM circle.circle c JOIN circle.circle d ON d.id = coalesce(c.parent, c.id) WHERE c.id = $1`,
    [circle],
  )
  if (!found.rows[0]) {
    return null
  }
  const under = await db.query<{ id: string; name: string }>(
    `SELECT u.id, u.name FROM circle.circle u, circle.circle c
     WHERE c.id = $1 AND NOT (c.id = ANY(u.path)) AND u.id IS DISTINCT FROM c.parent ORDER BY u.path`,
    [circle],
  )
  const roles = await db.query<{ id: string; name: string }>(
    `SELECT r.id, r.name FROM circle.role r, circle.circle c
     WHERE c.id = $1 AND (r.circle = c.id OR (r.circle = '*' AND c.parent IS NULL)) ORDER BY r.circle = '*', r.name`,
    [circle],
  )
  const mandates = await db.query<{ id: string; label: string }>(
    `SELECT m.id::text AS id, m.power || ' (' || r.name || ')' AS label
     FROM circle.mandate m JOIN circle.role r ON r.id = m.role
     WHERE r.id = ANY($1) AND m.revoked IS NULL ORDER BY r.name, m.power`,
    [roles.rows.map((r) => r.id)],
  )
  const open = await db.query<Proposing['open'][number]>(
    `SELECT m.motion, d.title, m.kind, to_char(d.deadline, 'YYYY-MM-DD') AS deadline
     FROM circle_motion.action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.circle = $1 AND d.closed IS NULL ORDER BY d.deadline, m.motion`,
    [circle],
  )
  return { circle, decider: found.rows[0].decider, under: under.rows, roles: roles.rows, mandates: mandates.rows, open: open.rows, policies: await inForce(db, circle) }
}
