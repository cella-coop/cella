import type { Permission } from '@cella/org-actions'
import type { Db } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Held, Seat } from '@cella/org-circle/models'
import type { Power } from '../models/power.ts'

const seat = `p.id::text AS id, p.circle, c.name AS "circleName", p.member, mp.name AS "memberName", p.role, r.name AS "roleName",
  to_char(p.since, 'YYYY-MM-DD') AS since, to_char(p.until, 'YYYY-MM-DD') AS until, c.procedure, c.assembly AS root`

const from = `FROM circle.seat p
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

// The mandates a member holds on the verdict date, as `circle_person.holds`
// gives them: what `circle_person.may` grants them, before any limit is
// spent, the participant's once for each circle they sit in.
export async function held(db: Db, member: string): Promise<Held[]> {
  const { rows } = await db.query<Omit<Held, 'sentence'>>(
    `SELECT md.id || '@' || h.circle AS id, md.power, md.policy, cella.cents(md."limit") AS "limit", md.grantee AS role, h.circle, c.name AS "circleName"
     FROM circle_person.holds($1, cella.verdict_date()) h
     JOIN circle.mandate md ON md.id = h.mandate
     JOIN circle.circle c ON c.id = h.circle
     ORDER BY md.power, c.name, md.id`,
    [member],
  )
  // Each mandate reads as its policy's sentence, from the register.
  const read = await sentences(db, rows.map((r) => r.policy))
  return rows.map((r) => ({ ...r, sentence: read.get(r.policy) ?? r.policy, limit: r.limit === null ? null : Number(r.limit) }))
}

// Every power a person holds on the verdict date and what through, as
// `circle_person.may` and `circle_person.entitled` grant it: each mandate
// `circle_person.holds` gives, in the circle of its seat, with the tenure
// that holds its role there, none for the participant's, and its caps and
// scope; and each right `circle_person.rights` gives, with its power and
// limit, which it reads as its owner and answers the reader for
// themselves, or for anyone where they are a member: never by joining
// `circle.right`, which a non-member reads no row of. A power held twice
// is listed twice.
export async function powers(db: Db, member: string): Promise<Power[]> {
  const { rows } = await db.query<Power>(
    `SELECT 'm' || md.id || '@' || h.circle || coalesce('#' || t.id, '') AS id, md.power, md.id::text AS mandate,
       h.circle, c.name AS "circleName", t.role, r.name AS "roleName", t.id::text AS tenure,
       to_char(t.since, 'YYYY-MM-DD') AS since, to_char(t.until, 'YYYY-MM-DD') AS until,
       cella.cents(md."limit") AS "limit", cella.cents(md.budget) AS budget, md.per, md.scope, sc.name AS "scopeName", NULL::text AS "right"
     FROM circle_person.holds($1, cella.verdict_date()) h
     JOIN circle.mandate md ON md.id = h.mandate
     JOIN circle.circle c ON c.id = h.circle
     LEFT JOIN circle.tenure t ON t.holder = $1 AND t.role = md.grantee AND t.circle = h.circle
       AND (t.since IS NULL OR t.since <= cella.verdict_date()) AND (t.until IS NULL OR t.until > cella.verdict_date())
     LEFT JOIN circle.role r ON r.id = t.role
     LEFT JOIN circle.circle sc ON sc.id = md.scope
     UNION ALL
     SELECT 'r' || g.id, g.power, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       cella.cents(g."limit"), NULL, NULL, NULL, NULL, g."right"
     FROM circle_person.rights($1, cella.verdict_date()) g
     ORDER BY power, "right" NULLS FIRST, "circleName", tenure NULLS LAST, mandate`,
    [member],
  )
  const amount = (v: number | string | null) => (v === null ? null : Number(v))
  return rows.map((r) => ({ ...r, limit: amount(r.limit), budget: amount(r.budget) }))
}

// The circles each member sits in now, by address.
export const circlesOf = `SELECT member AS id, string_agg(DISTINCT circle, ', ' ORDER BY circle) AS circles
  FROM circle.seat WHERE until IS NULL GROUP BY member`

// How many members sit in each circle now, by circle, none where no one does.
export const seated = `SELECT c.id, count(DISTINCT p.member)::int AS seated
  FROM circle.circle c LEFT JOIN circle.seat p ON p.circle = c.id AND p.until IS NULL GROUP BY c.id`

// A member's name, for their page to call them by when they sit nowhere.
export async function named(db: Db, member: string): Promise<string> {
  const { rows } = await db.query<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [member])
  return rows[0]?.name ?? member
}

// Whether a person holds a power over a record of a circle on the verdict
// date, by a seat's mandate covering it or by a right, as circle-person's
// guard on every write with a power asks.
export async function may(db: Db, actor: string, power: string, circle: string): Promise<boolean> {
  const { rows } = await db.query<{ may: boolean }>(
    `SELECT circle_person.may($1, $2, NULL, $3, cella.verdict_date())
         OR circle_person.entitled($1, $2, NULL, cella.verdict_date()) AS may`,
    [actor, power, circle],
  )
  return rows[0]?.may ?? false
}

// Why the reader may not make each write on a record of a circle, before
// they make it, in one read: circle-person's judgement of each op, the
// guard's own function with no amount (`circle_person.judged`), for the
// ops it refuses alone.
export async function judge(db: Db, ops: Permission[], circle: string | null): Promise<Partial<Record<Permission, string>>> {
  if (!ops.length) {
    return {}
  }
  const { rows } = await db.query<{ op: Permission; reason: string | null }>(
    'SELECT o AS op, circle_person.judged(o, $2) AS reason FROM unnest($1::text[]) o',
    [ops, circle],
  )
  return Object.fromEntries(rows.flatMap((r) => (r.reason ? [[r.op, r.reason]] : [])))
}
