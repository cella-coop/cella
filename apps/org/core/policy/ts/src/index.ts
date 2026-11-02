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
// a day as YYYY-MM-DD), and which way is stricter, where it says.
export interface Value {
  name: string
  type: 'amount' | 'share' | 'day' | 'number' | 'role' | 'power' | 'text'
  literal: string
  value: string | number
  stricter: 'more' | 'less' | null
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
  // The procedure by which alone it is replaced or ended, if it names one.
  protected: string | null
  // The default policy of a legal form it takes, if any, and whether cella
  // has changed that default since, so a motion may take its new wording.
  takes: string | null
  outdated: boolean
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
  // The procedure by which alone it is replaced or ended, for a protected
  // policy.
  protected?: string | null
  // The default policy of a legal form it takes, worded and protected as
  // that default reads.
  takes?: string | null
}

// Adopts a policy in the write's transaction, through the register's own
// function; a flawed wording or a replacement of a policy not in force is
// refused there. Returns its id.
export async function adopting(tx: Db, p: Adopting): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    'SELECT policy.adopt($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11) AS id',
    [p.circle, p.kind, p.legal, p.friendly ?? null, p.motion, p.n, p.applies, p.until ?? null, p.replaces ?? null, p.protected ?? null, p.takes ?? null],
  )
  return rows[0].id
}

const select = `SELECT p.id, p.circle, p.kind, p.motion, policy.sentence(w.legal) AS sentence, w.legal, w.friendly,
         coalesce((SELECT json_agg(json_build_object('name', v.name, 'type', v.type, 'literal', v.literal, 'value', v.value, 'stricter', v.stricter) ORDER BY v.n)
                   FROM policy.value v WHERE v.policy = p.id), '[]') AS values,
         to_char(p.adopted, 'YYYY-MM-DD') AS adopted, to_char(p.applies, 'YYYY-MM-DD') AS applies,
         to_char(p.ends, 'YYYY-MM-DD') AS ends, p.replaces, p.protected, p.takes,
         coalesce((SELECT d.hash <> p.hash OR d.protected IS DISTINCT FROM p.protected FROM policy.default d WHERE d.id = p.takes), false) AS outdated
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

// Ends a policy on the verdict date in the write's transaction, by the
// motion's action `n`, through the register's own function; a policy not
// in force is refused there. Returns the day it ends.
export async function ending(tx: Db, policy: string, motion: string, n: number): Promise<string> {
  const { rows } = await tx.query<{ ends: string }>(`SELECT to_char(policy.end($1, $2, $3), 'YYYY-MM-DD') AS ends`, [policy, motion, n])
  return rows[0].ends
}

// The legal wording of each policy named, as it reads, by its id.
export async function sentences(db: Db, ids: string[]): Promise<Map<string, string>> {
  const { rows } = await db.query<{ id: string; sentence: string }>(
    'SELECT w.policy AS id, policy.sentence(w.legal) AS sentence FROM policy.wording w WHERE w.policy = ANY($1)',
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r.sentence]))
}

// A policy as a generated document reads it: its id, its kind and its
// legal wording as it reads.
export interface Ordered {
  id: string
  kind: Kind
  sentence: string
}

// A circle's policies in force on a day, in their order: each where the
// first policy of its line reads (the policy it replaces, the one that
// one replaced, and so on back), by the motion and the action that
// adopted that one, so a replacement takes the place of the policy it
// replaces. As the document feat generates the statutes.
export async function inOrder(db: Db, circle: string, day: string): Promise<Ordered[]> {
  const { rows } = await db.query<Ordered>(
    `WITH RECURSIVE line (id, first) AS (
       SELECT p.id, p.id FROM policy.policy p WHERE p.replaces IS NULL
       UNION ALL
       SELECT p.id, l.first FROM policy.policy p JOIN line l ON p.replaces = l.id
     )
     SELECT f.id, f.kind, policy.sentence(w.legal) AS sentence
     FROM policy.in_force($1, $2::date) f
     JOIN policy.wording w ON w.policy = f.id
     JOIN line l ON l.id = f.id
     JOIN policy.policy o ON o.id = l.first
     ORDER BY o.motion, o.n`,
    [circle, day],
  )
  return rows
}

// A default policy of a legal form, as the register offers it: its id
// (`scop-sarl-fr:ordinary`), its form in words (`SCOP SARL, France`), its
// kind, its sentence as it reads, the law it states, if any, and the day
// a co-op lawyer reviewed it, if one has.
export interface Default {
  id: string
  form: string
  kind: Kind
  sentence: string
  source: string | null
  reviewed: string | null
}

// Every default the register offers, form by form in its order, as the
// New motion form offers them to take.
export async function defaults(db: Db): Promise<Default[]> {
  const { rows } = await db.query<Default>(
    `SELECT d.id, f.label || ', ' || f.region AS form, d.kind, policy.sentence(d.legal) AS sentence, d.source,
            to_char(d.reviewed, 'YYYY-MM-DD') AS reviewed
     FROM policy.default d JOIN policy.form f ON f.id = d.form ORDER BY f.id, d.n`,
  )
  return rows
}

// Where a default stands in a circle: taken as it reads, taken as it read
// before cella updated it, left, or never taken.
export type Stand = 'taken' | 'updated' | 'left' | 'not taken'

// A default of a form the circle took any default of, and where it
// stands there: the policy that takes it, or last took it, and, once
// left, the motion's action that left it and the day.
export interface Standing extends Default {
  standing: Stand
  policy: string | null
  leftBy: string | null
  leftOn: string | null
}

// Where each default stands in a circle on a day, today unless one is
// named, in its form's order (`policy.standing`).
export async function standing(db: Db, circle: string, day?: string): Promise<Standing[]> {
  const { rows } = await db.query<Standing>(
    `SELECT s.id, s.form_label AS form, s.kind, s.sentence, s.source, to_char(s.reviewed, 'YYYY-MM-DD') AS reviewed,
            s.standing, s.policy, s.left_by AS "leftBy", to_char(s.left_on, 'YYYY-MM-DD') AS "leftOn"
     FROM policy.standing($1, coalesce($2::date, cella.verdict_date())) s`,
    [circle, day ?? null],
  )
  return rows
}

// A default a motion left: its id, its form in words, its sentence as it
// reads, the policy that took it and the motion's action that left it.
export interface Left {
  id: string
  form: string
  sentence: string
  policy: string
  action: string
}

// The defaults a motion left, by its actions (`policy.left_by`).
export async function leftBy(db: Db, motion: string): Promise<Left[]> {
  const { rows } = await db.query<Left>(
    'SELECT l.id, l.form_label AS form, l.sentence, l.policy, l.action FROM policy.left_by($1) l',
    [motion],
  )
  return rows
}

// The defaults of its form a circle left, or never took, on a day, today
// unless one is named: as its page lists them and the statutes read them.
export async function departures(db: Db, circle: string, day?: string): Promise<Standing[]> {
  return (await standing(db, circle, day)).filter((s) => s.standing === 'left' || s.standing === 'not taken')
}
