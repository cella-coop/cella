import type { Db } from '@cella/org-db'
import { departures, inForce } from '@cella/org-policy'
import type { Deciding, Proposing } from '../models/circles.ts'

// Every circle, the assembly first and the others by name, with the
// procedure its motions follow.
export async function deciding(db: Db): Promise<Deciding[]> {
  const { rows } = await db.query<Deciding>('SELECT id, name, procedure FROM circle.circle ORDER BY assembly DESC, name')
  return rows
}

// What a circle's page offers to propose about it, the policies it has
// adopted that are in force, and the defaults of its form it left or
// never took. Its seats are decided by another circle holding
// `seat-member`, or else the assembly (`motion.decider`).
export async function proposing(db: Db, circle: string): Promise<Proposing | null> {
  const found = await db.query<{ decider: Deciding }>(
    `SELECT json_build_object('id', d.id, 'name', d.name, 'procedure', d.procedure) AS decider
     FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['seat-member'], cella.verdict_date())
     WHERE c.id = $1`,
    [circle],
  )
  if (!found.rows[0]) {
    return null
  }
  const circles = await db.query<{ id: string; name: string }>('SELECT id, name FROM circle.circle ORDER BY assembly DESC, name')
  const roles = await db.query<{ id: string; name: string }>(
    `SELECT r.id, r.name FROM circle.role r, circle.circle c
     WHERE c.id = $1 AND (r.circle = c.id OR (r.circle = '*' AND c.assembly)) ORDER BY r.circle = '*', r.name`,
    [circle],
  )
  const mandates = await db.query<{ policy: string; label: string }>(
    `SELECT m.policy, m.power || ' (' || r.name || ')' AS label
     FROM circle.mandate m JOIN circle.role r ON r.id = m.grantee
     WHERE r.id = ANY($1) AND (m.revoked IS NULL OR m.revoked > cella.verdict_date()) ORDER BY r.name, m.power`,
    [roles.rows.map((r) => r.id)],
  )
  const open = await db.query<Proposing['open'][number]>(
    `SELECT m.motion, d.title, m.kind, to_char(d.deadline, 'YYYY-MM-DD') AS deadline
     FROM motion.circle_action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.circle = $1 AND d.closed IS NULL ORDER BY d.deadline, m.motion`,
    [circle],
  )
  return {
    circle,
    decider: found.rows[0].decider,
    circles: circles.rows,
    roles: roles.rows,
    mandates: mandates.rows,
    open: open.rows,
    policies: await inForce(db, circle),
    departures: await departures(db, circle),
  }
}
