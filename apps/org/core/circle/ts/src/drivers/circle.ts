import type { Db, Read } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Circle, Depth, Detail, Lens, Standing, Provenance, Role, Sat } from '../models/circle.ts'

// Circles never nest, so they list the assembly first and the others by
// name.
const order = '(CASE WHEN c.assembly THEN 0 ELSE 1 END)::text || c.name'

// The circles as the collection lists them.
export const listing: Read = {
  sql: `SELECT c.id, c.name, c.assembly, c.purpose, c.procedure, ${order} AS listed FROM circle.circle c`,
  order: 'listed',
}

// The circles, the assembly first and the others by name.
export async function circles(db: Db): Promise<Circle[]> {
  const { rows } = await db.query<Circle>(`SELECT c.id, c.name, c.assembly, c.purpose, c.procedure FROM circle.circle c ORDER BY ${order}`)
  return rows
}

// The circles a person sits in on any day from `from` to `until`, both
// included, by any seat, the assembly first and the others by name.
export async function sitting(db: Db, person: string, from: string, until: string): Promise<Sat[]> {
  const { rows } = await db.query<Sat>(
    `SELECT c.id, c.name FROM circle.circle c
     WHERE EXISTS (
       SELECT FROM circle.seat s WHERE s.circle = c.id AND s.member = $1
         AND (s.since IS NULL OR s.since <= $3::date) AND (s.until IS NULL OR s.until > $2::date)
     )
     ORDER BY ${order}`,
    [person, from, until],
  )
  return rows
}

// The circles a person may lens the co-op on: every circle they read,
// those they sit in on `day` first, then the rest, each in the circles'
// order.
export async function lenses(db: Db, person: string, day: string): Promise<Lens[]> {
  const { rows } = await db.query<Lens>(
    `SELECT c.id, c.name, EXISTS (
       SELECT FROM circle.seat s WHERE s.circle = c.id AND s.member = $1
         AND (s.since IS NULL OR s.since <= $2::date) AND (s.until IS NULL OR s.until > $2::date)
     ) AS sits
     FROM circle.circle c
     ORDER BY sits DESC, ${order}`,
    [person, day],
  )
  return rows
}

// A circle, its roles, those every circle but the assembly has among
// them, the mandates granted to those roles, each as the Mandates
// collection reads it, with its policy's sentence,
// and how the mandates link it to the other circles: those that issued
// what it and its roles hold, and those it issued to.
export async function circle(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Circle>('SELECT c.id, c.name, c.assembly, c.purpose, c.procedure FROM circle.circle c WHERE c.id = $1', [id])
  const c = found.rows[0]
  if (!c) {
    return null
  }
  const roles = await db.query<Role>(
    `SELECT id, circle, name, duty FROM circle.role WHERE circle = $1 OR (circle = '*' AND NOT $2) ORDER BY circle = '*', name`,
    [id, c.assembly],
  )
  const mandates = await db.query<Omit<Standing, 'sentence'>>(
    `SELECT ${held} FROM circle.mandate m ${joined} WHERE m.grantee = ANY($1) ORDER BY m.grantee, m.power, m."from"`,
    [roles.rows.map((r) => r.id)],
  )
  // A grantee is this circle's when it is the circle or one of its own
  // roles; a role every circle has links no circle by itself.
  const links = await db.query<{ id: string; name: string; way: 'issuer' | 'issued' }>(
    `SELECT DISTINCT o.id, o.name, 'issuer' AS way
     FROM circle.mandate m JOIN circle.circle o ON o.id = m.issuer
     WHERE o.id <> $1 AND (m.grantee = $1 OR m.grantee IN (SELECT r.id FROM circle.role r WHERE r.circle = $1))
     UNION
     SELECT DISTINCT o.id, o.name, 'issued'
     FROM circle.mandate m
     LEFT JOIN circle.role r ON r.id = m.grantee
     JOIN circle.circle o ON o.id = coalesce(r.circle, m.grantee)
     WHERE m.issuer = $1 AND o.id <> $1
     ORDER BY name`,
    [id],
  )
  // Each mandate reads as its policy's sentence, from the register.
  const read = await sentences(db, mandates.rows.map((m) => m.policy))
  return {
    ...c,
    issuers: links.rows.filter((l) => l.way === 'issuer').map(({ id, name }) => ({ id, name })),
    issued: links.rows.filter((l) => l.way === 'issued').map(({ id, name }) => ({ id, name })),
    roles: roles.rows,
    mandates: mandates.rows.map((m) => ({ ...m, sentence: read.get(m.policy) ?? m.policy, limit: num(m.limit), budget: num(m.budget) })),
  }
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

// A mandate's grant as its page reads it, `m` the mandate: its grantee's
// name and circle, its issuer's name and that of the circle its scope
// covers, the motion that adopted its policy, and where it
// stands on the verdict date, an end by revocation or term since the day
// it came.
const held = `m.id::text, m.grantee, coalesce(r.name, g.name, m.grantee) AS "granteeName",
  CASE WHEN r.id IS NULL THEN g.id WHEN r.circle <> '*' THEN r.circle END AS circle,
  m.issuer, coalesce(i.name, m.issuer) AS "issuerName", s.name AS "scopeName", m.parent::text, m.power, m.policy, p.motion, m.procedure,
  cella.cents(m."limit") AS "limit", cella.cents(m.budget) AS budget, m.per, m.scope,
  to_char(m."from", 'YYYY-MM-DD') AS "from", to_char(m.until, 'YYYY-MM-DD') AS until, to_char(m.revoked, 'YYYY-MM-DD') AS revoked,
  CASE WHEN m.revoked <= cella.verdict_date() AND (m.until IS NULL OR m.revoked <= m.until) THEN 'revoked'
       WHEN m.until <= cella.verdict_date() THEN 'expired'
       WHEN m."from" > cella.verdict_date() THEN 'pending'
       ELSE 'stands' END AS state,
  to_char(CASE WHEN m.revoked <= cella.verdict_date() AND (m.until IS NULL OR m.revoked <= m.until) THEN m.revoked
       WHEN m.until <= cella.verdict_date() THEN m.until
       ELSE m."from" END, 'YYYY-MM-DD') AS since`
const joined = `LEFT JOIN circle.role r ON r.id = m.grantee
  LEFT JOIN circle.circle g ON g.id = m.grantee
  LEFT JOIN circle.circle i ON i.id = m.issuer
  LEFT JOIN circle.circle s ON s.id = m.scope
  LEFT JOIN policy.policy p ON p.id = m.policy`

// The mandates as the collection lists them, by power, then by the day
// each came.
export const mandating: Read = {
  sql: `SELECT ${held} FROM circle.mandate m ${joined}`,
  order: 'power, "from", id::bigint',
}

// A mandate and where its authority comes from: its chain by
// `circle.chain`, from the root the assembly issued down to itself, and
// what was issued under it by `circle.under`, each read as the structure
// is, so a link the reader does not read is left out, and with it every
// link above, withheld where the highest link read has a parent; or null
// where the reader reads no such mandate.
export async function mandate(db: Db, id: string): Promise<Provenance | null> {
  if (!/^\d+$/.test(id)) {
    return null
  }
  const found = await db.query<Omit<Standing, 'sentence'>>(`SELECT ${held} FROM circle.mandate m ${joined} WHERE m.id = $1`, [id])
  const m = found.rows[0]
  if (!m) {
    return null
  }
  const chain = await db.query<Omit<Depth, 'sentence'>>(
    `SELECT ${held}, k.depth FROM circle.chain($1) k JOIN circle.mandate m ON m.id = k.id ${joined} ORDER BY k.depth`,
    [id],
  )
  const under = await db.query<Omit<Depth, 'sentence'>>(
    `SELECT ${held}, u.depth FROM circle.under($1) u JOIN circle.mandate m ON m.id = u.id ${joined} WHERE u.depth > 0 ORDER BY u.depth, m.id`,
    [id],
  )
  const all = [m, ...chain.rows, ...under.rows]
  const read = await sentences(db, [...new Set(all.map((x) => x.policy))])
  const worded = <T extends Omit<Standing, 'sentence'>>(x: T) => ({ ...x, sentence: read.get(x.policy) ?? x.policy, limit: num(x.limit), budget: num(x.budget) })
  const withheld = (chain.rows[0]?.parent ?? null) !== null
  return { ...worded(m), chain: chain.rows.map(worded), under: under.rows.map(worded), withheld }
}
