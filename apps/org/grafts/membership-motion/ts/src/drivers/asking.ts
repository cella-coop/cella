import type { Db } from '@cella/org-db'
import type { Amending, Appointing, Decider, Standing } from '../models/asking.ts'

const decider = `json_build_object('id', d.id, 'name', d.name, 'procedure', d.procedure)`

// A member's standing, the assembly that decides it, and the open
// motions asking something of them; on one's own page, whether one has
// applied, whether one is an employee, who may, and the deadline an
// application's motion starts from, two
// weeks on. Someone with no membership has a standing only on their own
// page, where they may apply.
export async function standing(db: Db, member: string, actor?: string | null): Promise<Standing | null> {
  const own = actor === member
  const found = await db.query<Omit<Standing, 'member' | 'open' | 'own'>>(
    `SELECT m.status, to_char(m.applied, 'YYYY-MM-DD') AS applied, ${decider} AS decider,
            person.holds($1, 'employee', cella.verdict_date()) AS employee, to_char(cella.verdict_date() + 14, 'YYYY-MM-DD') AS until
     FROM circle.applied() d LEFT JOIN membership.member m ON m.address = $1
     WHERE (m.address IS NOT NULL OR $2)`,
    [member, own],
  )
  if (!found.rows[0]) {
    return null
  }
  const open = await db.query<Standing['open'][number]>(
    `SELECT d.id AS motion, d.title, to_char(d.deadline, 'YYYY-MM-DD') AS deadline
     FROM membership_motion.action a JOIN motion.motion d ON d.id = a.motion
     WHERE a.member = $1 AND d.closed IS NULL ORDER BY d.deadline`,
    [member],
  )
  return { member, ...found.rows[0], own, open: open.rows }
}

// Whom a motion may seat in a circle, anyone whose seat would count
// there, and in which of its roles; the seats held there, and the circle
// that decides.
export async function appointing(db: Db, circle: string): Promise<Appointing | null> {
  const found = await db.query<{ decider: Decider; root: boolean }>(
    `SELECT ${decider} AS decider, c.assembly AS root FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['seat-member'], cella.verdict_date()) WHERE c.id = $1`,
    [circle],
  )
  if (!found.rows[0]) {
    return null
  }
  const members = await db.query<{ id: string; name: string }>(
    `SELECT p.address AS id, p.name FROM person.person p WHERE membership.counts(p.address, $1, cella.verdict_date()) ORDER BY p.name`,
    [circle],
  )
  const roles = await db.query<{ id: string; name: string }>(
    `SELECT r.id, r.name FROM circle.role r WHERE r.circle = $1 OR (r.circle = '*' AND NOT $2) ORDER BY r.name`,
    [circle, found.rows[0].root],
  )
  const seats = await db.query<Appointing['seats'][number]>(
    `SELECT p.id::text AS id, mp.name || coalesce(', ' || r.name, '') AS label, p.member, p.role
     FROM circle.seat p JOIN person.person mp ON mp.address = p.member LEFT JOIN circle.role r ON r.id = p.role
     WHERE p.circle = $1 AND p.id IS NOT NULL AND p.until IS NULL ORDER BY mp.name, r.name`,
    [circle],
  )
  return { circle, decider: found.rows[0].decider, members: members.rows, roles: roles.rows, seats: seats.rows }
}

// A circle's terms on its Settings tab, from those in force: its name,
// purpose and procedure; the procedures in force it may take
// (`membership_motion.procedures`); the circle that decides its
// amendment, the assembly unless another holding `amend-circle` may
// (`motion.decider`), and the deadline asked, two weeks on; and why no
// write of the reader's changes them, since only a motion amends a
// circle.
export async function amending(db: Db, circle: string): Promise<Amending | null> {
  const { rows } = await db.query<Amending>(
    `SELECT c.id AS circle, c.name, c.purpose, c.procedure,
            (SELECT coalesce(json_agg(json_build_object('value', o.id, 'label', o.label) ORDER BY o.label), '[]')
             FROM motion.procedure o WHERE o.id IN (SELECT membership_motion.procedures(cella.verdict_date()))) AS procedures,
            json_build_object('circle', d.id, 'name', d.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) AS decider,
            c.name || '''s name, purpose and procedure change only by a motion of ' || d.name || ', which holds amend-circle: no one''s own write amends a circle' AS refused
     FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['amend-circle'], cella.verdict_date())
     WHERE c.id = $1`,
    [circle],
  )
  return rows[0] ?? null
}
