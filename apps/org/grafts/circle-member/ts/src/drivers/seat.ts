import type { Db } from '@cella/org-db'
import type { Held, Seat } from '../models/position.ts'

const seat = `p.id::text AS id, p.circle, c.name AS "circleName", p.member, m.name AS "memberName", p.role, r.name AS "roleName",
  to_char(p.since, 'YYYY-MM-DD') AS since, to_char(p.until, 'YYYY-MM-DD') AS until, c.procedure, c.parent IS NULL AS root`

const from = `FROM circle_member.position p
  JOIN circle.circle c ON c.id = p.circle
  LEFT JOIN member.member m ON m.address = p.member
  LEFT JOIN circle.role r ON r.id = p.role`

// The seats in a circle, or a member's; ended ones last.
export async function seats(db: Db, by: { circle?: string; member?: string }): Promise<Seat[]> {
  const { rows } = await db.query<Seat>(
    `SELECT ${seat} ${from}
     WHERE ($1::text IS NULL OR p.circle = $1) AND ($2::text IS NULL OR p.member = $2)
     ORDER BY p.until IS NOT NULL, p.role IS NULL, m.name, c.name`,
    [by.circle ?? null, by.member ?? null],
  )
  return rows
}

// The mandates a member holds through the seats they hold now: what
// `circle_member.may` grants them, before any limit is spent.
export async function held(db: Db, member: string): Promise<Held[]> {
  const { rows } = await db.query<Held>(
    `SELECT DISTINCT ON (md.power, md.id) md.id::text AS id, md.power, md.text, cella.cents(md."limit") AS "limit", md.role, p.circle, c.name AS "circleName"
     FROM circle_member.position p
     JOIN circle.mandate md ON md.role = p.role
     JOIN circle.circle c ON c.id = p.circle
     WHERE p.member = $1 AND p.until IS NULL AND md.revoked IS NULL AND md.until IS NULL
     ORDER BY md.power, md.id`,
    [member],
  )
  return rows.map((r) => ({ ...r, limit: r.limit === null ? null : Number(r.limit) }))
}

// The circles each member sits in now, by address.
export async function circlesOf(db: Db): Promise<Record<string, { circles: string }>> {
  const { rows } = await db.query<{ member: string; circles: string }>(
    `SELECT member, string_agg(DISTINCT circle, ', ' ORDER BY circle) AS circles
     FROM circle_member.position WHERE until IS NULL GROUP BY member`,
  )
  return Object.fromEntries(rows.map((r) => [r.member, { circles: r.circles }]))
}

// How many members sit in each circle now, by circle.
export async function seated(db: Db): Promise<Record<string, { seated: number }>> {
  const { rows } = await db.query<{ circle: string; seated: number }>(
    `SELECT circle, count(DISTINCT member)::int AS seated FROM circle_member.position WHERE until IS NULL GROUP BY circle`,
  )
  return Object.fromEntries(rows.map((r) => [r.circle, { seated: r.seated }]))
}

// A member's name, for their page to call them by when they sit nowhere.
export async function named(db: Db, member: string): Promise<string> {
  const { rows } = await db.query<{ name: string }>('SELECT name FROM member.member WHERE address = $1', [member])
  return rows[0]?.name ?? member
}
