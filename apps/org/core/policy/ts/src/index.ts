import type { Db } from '@cella/org-db'

// The kinds of policy: who may do something, what else the co-op
// agreed, and how a circle decides.
export type Kind = 'mandate' | 'rule' | 'procedure'

export const kinds: { value: Kind; label: string }[] = [
  { value: 'mandate', label: 'Mandate: who may do something' },
  { value: 'rule', label: 'Rule: what else the co-op agreed' },
  { value: 'procedure', label: 'Procedure: how a circle decides' },
]

// A value marked in a policy's legal wording, `{rate: 20 %}`: its name,
// its type, as written and typed (an amount in cents, a share in percent,
// a day as YYYY-MM-DD).
export interface Value {
  name: string
  type: 'amount' | 'share' | 'day' | 'number' | 'role' | 'power' | 'text'
  literal: string
  value: string | number
}

// A policy as the register keeps it: its id, the action that adopted it
// (`m-2026-013/1`), its circle and kind, its legal wording as it reads and
// as marked, perhaps a friendly one, its values, and its days.
export interface Policy {
  id: string
  circle: string
  kind: Kind
  motion: string
  sentence: string
  legal: string
  friendly: string | null
  values: Value[]
  adopted: string
  applies: string
  ends: string | null
  replaces: string | null
}

// What adopting a policy writes, inside the write of the action that
// adopts it.
export interface Adopting {
  circle: string
  kind: Kind
  legal: string
  friendly?: string | null
  motion: string
  n: number
  // The day it applies from, YYYY-MM-DD.
  applies: string
  until?: string | null
  replaces?: string | null
}

// Adopts a policy in the write's transaction, through the register's own
// function; a flawed wording or a replacement of a policy not in force is
// refused there. Returns its id.
export async function adopting(tx: Db, p: Adopting): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    'SELECT policy.adopt($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9) AS id',
    [p.circle, p.kind, p.legal, p.friendly ?? null, p.motion, p.n, p.applies, p.until ?? null, p.replaces ?? null],
  )
  return rows[0].id
}

const select = `SELECT p.id, p.circle, p.kind, p.motion, policy.sentence(w.legal) AS sentence, w.legal, w.friendly,
         coalesce((SELECT json_agg(json_build_object('name', v.name, 'type', v.type, 'literal', v.literal, 'value', v.value) ORDER BY v.n)
                   FROM policy.value v WHERE v.policy = p.id), '[]') AS values,
         to_char(p.adopted, 'YYYY-MM-DD') AS adopted, to_char(p.applies, 'YYYY-MM-DD') AS applies,
         to_char(p.ends, 'YYYY-MM-DD') AS ends, p.replaces
  FROM policy.policy p JOIN policy.wording w ON w.policy = p.id`

// The policies of a circle in force today, by the day each applies.
export async function inForce(db: Db, circle: string): Promise<Policy[]> {
  const { rows } = await db.query<Policy>(
    `${select} WHERE p.id IN (SELECT f.id FROM policy.in_force($1, cella.verdict_date()) f) ORDER BY p.applies, p.id`,
    [circle],
  )
  return rows
}

// Every policy the register keeps, in force or not, newest first.
export async function register(db: Db): Promise<Policy[]> {
  const { rows } = await db.query<Policy>(`${select} ORDER BY p.adopted DESC, p.id DESC`)
  return rows
}
