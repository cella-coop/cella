import type { Db } from '@cella/org-db'
import type { Appointing, Decider, Standing } from '../models/asking.ts'

const decider = `json_build_object('id', d.id, 'name', d.name, 'procedure', d.procedure)`

// A member's standing, the assembly that decides it, and the open
// decisions asking something of them.
export async function standing(db: Db, member: string): Promise<Standing | null> {
  const found = await db.query<{ status: Standing['status']; decider: Decider }>(
    `SELECT m.status, ${decider} AS decider FROM member.member m, circle.circle d WHERE m.address = $1 AND d.parent IS NULL`,
    [member],
  )
  if (!found.rows[0]) {
    return null
  }
  const open = await db.query<Standing['open'][number]>(
    `SELECT d.id AS decision, d.title, to_char(d.deadline, 'YYYY-MM-DD') AS deadline
     FROM decision_member.motion a JOIN decision.decision d ON d.id = a.decision
     WHERE a.member = $1 AND d.closed IS NULL ORDER BY d.deadline`,
    [member],
  )
  return { member, ...found.rows[0], open: open.rows }
}

// Whom a decision may seat in a circle and in which of its roles, the
// seats held there, and the circle that decides.
export async function appointing(db: Db, circle: string): Promise<Appointing | null> {
  const found = await db.query<{ decider: Decider; root: boolean }>(
    `SELECT ${decider} AS decider, c.parent IS NULL AS root FROM circle.circle c JOIN circle.circle d ON d.id = coalesce(c.parent, c.id) WHERE c.id = $1`,
    [circle],
  )
  if (!found.rows[0]) {
    return null
  }
  const members = await db.query<{ id: string; name: string }>(`SELECT address AS id, name FROM member.member WHERE status = 'active' ORDER BY name`)
  const roles = await db.query<{ id: string; name: string }>(
    `SELECT r.id, r.name FROM circle.role r WHERE r.circle = $1 OR (r.circle = '*' AND NOT $2) ORDER BY r.name`,
    [circle, found.rows[0].root],
  )
  const seats = await db.query<Appointing['seats'][number]>(
    `SELECT p.id::text AS id, m.name || coalesce(', ' || r.name, '') AS label, p.member, p.role
     FROM circle_member.position p JOIN member.member m ON m.address = p.member LEFT JOIN circle.role r ON r.id = p.role
     WHERE p.circle = $1 AND p.until IS NULL ORDER BY m.name, r.name`,
    [circle],
  )
  return { circle, decider: found.rows[0].decider, members: members.rows, roles: roles.rows, seats: seats.rows }
}
