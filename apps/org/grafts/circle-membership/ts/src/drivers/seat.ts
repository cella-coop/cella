import type { Db } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Held, Seat } from '../models/seat.ts'

const seat = `p.id::text AS id, p.circle, c.name AS "circleName", p.member, mp.name AS "memberName", p.role, r.name AS "roleName",
  to_char(p.since, 'YYYY-MM-DD') AS since, to_char(p.until, 'YYYY-MM-DD') AS until, c.procedure, c.parent IS NULL AS root`

const from = `FROM circle_membership.seat p
  JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN person.person mp ON mp.address = p.member
  LEFT JOIN circle.role r ON r.id = p.role`

// The seats in a circle, or a person's, member or not; ended ones last.
export async function seats(db: Db, by: { circle?: string; member?: string }): Promise<Seat[]> {
  const { rows } = await db.query<Seat>(
    `SELECT ${seat} ${from}
     WHERE ($1::text IS NULL OR p.circle = $1) AND ($2::text IS NULL OR p.member = $2)
     ORDER BY p.until IS NOT NULL, p.role IS NULL, mp.name, c.name`,
    [by.circle ?? null, by.member ?? null],
  )
  return rows
}

// The mandates a member holds through the seats they hold now: what
// `circle_membership.may` grants them, before any limit is spent.
export async function held(db: Db, member: string): Promise<Held[]> {
  const { rows } = await db.query<Omit<Held, 'sentence'>>(
    `SELECT DISTINCT ON (md.power, md.id) md.id::text AS id, md.power, md.policy, cella.cents(md."limit") AS "limit", md.grantee AS role, p.circle, c.name AS "circleName"
     FROM circle_membership.seat p
     JOIN circle.mandate md ON md.grantee = p.role
     JOIN circle.circle c ON c.id = p.circle
     WHERE p.member = $1 AND p.until IS NULL AND (md.revoked IS NULL OR md.revoked > cella.verdict_date()) AND md.until IS NULL
     ORDER BY md.power, md.id`,
    [member],
  )
  // Each mandate reads as its policy's sentence, from the register.
  const read = await sentences(db, rows.map((r) => r.policy))
  return rows.map((r) => ({ ...r, sentence: read.get(r.policy) ?? r.policy, limit: r.limit === null ? null : Number(r.limit) }))
}

// The circles each member sits in now, by address.
export const circlesOf = `SELECT member AS id, string_agg(DISTINCT circle, ', ' ORDER BY circle) AS circles
  FROM circle_membership.seat WHERE until IS NULL GROUP BY member`

// How many members sit in each circle now, by circle, none where no one does.
export const seated = `SELECT c.id, count(DISTINCT p.member)::int AS seated
  FROM circle.circle c LEFT JOIN circle_membership.seat p ON p.circle = c.id AND p.until IS NULL GROUP BY c.id`

// A member's name, for their page to call them by when they sit nowhere.
export async function named(db: Db, member: string): Promise<string> {
  const { rows } = await db.query<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [member])
  return rows[0]?.name ?? member
}
