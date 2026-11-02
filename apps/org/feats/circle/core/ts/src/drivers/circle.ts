import type { Db, Read } from '@cella/org-db'
import { sentences } from '@cella/org-policy'
import type { Circle, Detail, Mandate, Role } from '../models/circle.ts'

// The names from the assembly down to a circle, which order the tree.
const tree = '(SELECT array_agg(a.name ORDER BY u.i) FROM unnest(c.path) WITH ORDINALITY u(id, i) JOIN circle.circle a ON a.id = u.id)'

// The tree as the collection lists it, each circle after its parent.
export const listing: Read = {
  sql: `SELECT c.id, c.name, c.parent, c.purpose, c.procedure, ${tree} AS tree FROM circle.circle c`,
  order: 'tree',
}

// The tree, each circle after its parent, from the assembly down.
export async function circles(db: Db): Promise<Circle[]> {
  const { rows } = await db.query<Circle>(`SELECT c.id, c.name, c.parent, c.purpose, c.procedure FROM circle.circle c ORDER BY ${tree}`)
  return rows
}

// A circle, its children, its roles, those every working circle has among
// them, and the mandates granted to those roles, each as its policy reads.
export async function circle(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Circle & { parentName: string | null }>(
    `SELECT c.id, c.name, c.parent, c.purpose, c.procedure, p.name AS "parentName"
     FROM circle.circle c LEFT JOIN circle.circle p ON p.id = c.parent WHERE c.id = $1`,
    [id],
  )
  const c = found.rows[0]
  if (!c) {
    return null
  }
  const children = await db.query<{ id: string; name: string }>('SELECT id, name FROM circle.circle WHERE parent = $1 ORDER BY name', [id])
  const working = c.parent !== null && children.rows.length === 0
  const roles = await db.query<Role>(
    `SELECT id, circle, name, duty FROM circle.role WHERE circle = $1 OR (circle = '*' AND $2) ORDER BY circle = '*', name`,
    [id, working],
  )
  const mandates = await db.query<Omit<Mandate, 'sentence'>>(
    `SELECT id::text, role, power, policy, cella.cents("limit") AS "limit", cella.cents(budget) AS budget, per,
            to_char("from", 'YYYY-MM-DD') AS "from", to_char(until, 'YYYY-MM-DD') AS until, to_char(revoked, 'YYYY-MM-DD') AS revoked
     FROM circle.mandate WHERE role = ANY($1) ORDER BY role, power, "from"`,
    [roles.rows.map((r) => r.id)],
  )
  // Each mandate reads as its policy's sentence, from the register.
  const read = await sentences(db, mandates.rows.map((m) => m.policy))
  return {
    ...c,
    children: children.rows,
    roles: roles.rows,
    mandates: mandates.rows.map((m) => ({ ...m, sentence: read.get(m.policy) ?? m.policy, limit: num(m.limit), budget: num(m.budget) })),
  }
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
