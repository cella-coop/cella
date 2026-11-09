import type { Db } from '@cella/org-db'
import type { Amending, Appointing, Decider, Duty, Featuring, Organization, Ruling, Standing } from '../models/asking.ts'

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
    `SELECT p.address AS id, p.name FROM person.person p WHERE circle_person.counts(p.address, $1, cella.verdict_date()) ORDER BY p.name`,
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
// circle. Below them its roles, and on the assembly's those every working
// circle has but `participant`, built in: each its name, duty and cap,
// the circle that decides its amendment and why no write of the reader's
// changes it.
export async function amending(db: Db, circle: string): Promise<Amending | null> {
  const { rows } = await db.query<Omit<Amending, 'roles'>>(
    `SELECT c.id AS circle, c.name, c.purpose, c.procedure,
            (SELECT coalesce(json_agg(json_build_object('value', o.id, 'label', o.label) ORDER BY o.label), '[]')
             FROM motion.procedure o WHERE o.id IN (SELECT membership_motion.procedures(cella.verdict_date()))) AS procedures,
            json_build_object('circle', d.id, 'name', d.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) AS decider,
            c.name || '''s name, purpose and procedure change only by a motion of ' || d.name || ', which holds amend-circle: no one''s own write amends a circle' AS refused,
            c.name || '''s roles are made and changed only by a motion of ' || d.name || ', which holds amend-circle: no one''s own write changes a role' AS making
     FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['amend-circle'], cella.verdict_date())
     WHERE c.id = $1`,
    [circle],
  )
  if (!rows[0]) {
    return null
  }
  const roles = await db.query<Duty>(
    `SELECT r.id AS role, r.circle, r.name, r.duty, coalesce(r.holders::text, '') AS holders,
            json_build_object('circle', d.id, 'name', d.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) AS decider,
            CASE WHEN r.circle = '*' THEN 'A role of every working circle is' ELSE c.name || '''s roles are' END
              || ' made and changed only by a motion of ' || d.name || ', which holds amend-circle: no one''s own write changes a role' AS refused
     FROM circle.circle c
     JOIN circle.role r ON r.circle = c.id OR (c.assembly AND r.circle = '*' AND r.id <> 'participant')
     JOIN circle.circle d ON d.id = motion.decider(r.circle, ARRAY['amend-circle'], cella.verdict_date())
     WHERE c.id = $1
     ORDER BY r.circle = '*', r.name`,
    [circle],
  )
  return { ...rows[0], roles: roles.rows }
}

// The co-op's particulars in force and the procedure protecting them, the
// assembly that alone replaces them, and the scope's address and
// timezone, as Settings' Organization page shows them to every member.
export async function organization(db: Db): Promise<Organization> {
  const { rows } = await db.query<Organization>(
    `SELECT (SELECT to_jsonb(p) FROM circle.particulars() p) AS particulars,
            (SELECT r.protected FROM circle.particulars() p JOIN policy.policy r ON r.id = p.policy) AS protected,
            CASE WHEN a.id IS NOT NULL THEN json_build_object('circle', a.id, 'name', a.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) END AS decider,
            'The co-op''s particulars change only by a motion of ' || coalesce(a.name, 'the assembly')
              || ', which adopts them as a policy: no one''s own write changes them' AS refused,
            nullif(current_setting('cella.scope', true), '') AS scope,
            nullif(current_setting('cella.timezone', true), '') AS timezone
     FROM (SELECT) one LEFT JOIN circle.applied() a ON true`,
  )
  return rows[0]
}

// A circle's features page: its features in force, every feature the
// co-op installed, and the circle that decides their amendment, as the
// circle's Settings tab reads its terms; none for a circle there is not.
export async function featuring(db: Db, circle: string): Promise<Featuring | null> {
  const { rows } = await db.query<Featuring>(
    `SELECT c.id AS circle, c.name, circle.features(c.id) AS features,
            (SELECT coalesce(json_agg(i.f ORDER BY i.f), '[]') FROM circle.installed() i(f)) AS installed,
            json_build_object('circle', d.id, 'name', d.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) AS decider,
            c.name || '''s features change only by a motion of ' || d.name || ', which holds amend-circle: no one''s own write changes them' AS refused
     FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['amend-circle'], cella.verdict_date())
     WHERE c.id = $1`,
    [circle],
  )
  return rows[0] ?? null
}

// A circle's rules page: its settings as it has them
// (`circle.settings`), and the circle that decides a rule changing them,
// the circle itself where it holds `adopt-policy`, else the assembly;
// none for a circle there is not.
export async function ruling(db: Db, circle: string): Promise<Ruling | null> {
  const { rows } = await db.query<Ruling>(
    `SELECT c.id AS circle, c.name, c.assembly,
            (SELECT coalesce(json_agg(to_jsonb(s) ORDER BY s.name), '[]') FROM circle.settings(c.id) s) AS settings,
            json_build_object('circle', d.id, 'name', d.name, 'deadline', to_char(cella.verdict_date() + 14, 'YYYY-MM-DD')) AS decider,
            c.name || '''s settings change only by a rule a motion of ' || d.name || ' adopts: no one''s own write changes them' AS refused
     FROM circle.circle c
     JOIN circle.circle d ON d.id = CASE WHEN c.assembly OR circle.holds(c.id, 'adopt-policy', cella.verdict_date()) THEN c.id ELSE circle.assembly() END
     WHERE c.id = $1`,
    [circle],
  )
  return rows[0] ?? null
}
