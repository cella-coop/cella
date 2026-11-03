import type { Db, Read } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Circle, Detail, Mandate, Role } from '../models/circle.ts'

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

// A circle, its roles, those every circle but the assembly has among
// them, the mandates granted to those roles, each as its policy reads,
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
  const mandates = await db.query<Omit<Mandate, 'sentence'>>(
    `SELECT id::text, grantee, issuer, power, policy, cella.cents("limit") AS "limit", cella.cents(budget) AS budget, per, scope,
            to_char("from", 'YYYY-MM-DD') AS "from", to_char(until, 'YYYY-MM-DD') AS until, to_char(revoked, 'YYYY-MM-DD') AS revoked
     FROM circle.mandate WHERE grantee = ANY($1) ORDER BY grantee, power, "from"`,
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
