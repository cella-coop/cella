import type { Db } from '@cella/org-db'
import { departures, inForce } from '@cella/org-policy'
import type { Deciding, Held, Issuing, Mandate, Proposing } from '../models/circles.ts'
import type { Disclosure } from '../models/disclosure.ts'

// Every circle, the assembly first and the others by name, with the
// procedure its motions follow.
export async function deciding(db: Db): Promise<Deciding[]> {
  const { rows } = await db.query<Deciding>('SELECT id, name, procedure FROM circle.circle ORDER BY assembly DESC, name')
  return rows
}

// What a policy grants in words, as `worded` writes it: what follows its
// power, up to "by motion", its cap or its scope. Read from its wording
// only to fill a Change's form, never by a guard.
const grants = (wording: string) => /\{power: [^}]+\}, to (.*?)(?:, by motion|, up to \{|, within \{|, in \{|, in its \{|$)/.exec(wording)?.[1] ?? ''

// What a circle's page offers to propose about it, the policies it has
// adopted that are in force, and the defaults of its form it left or
// never took. Its seats are decided by another circle holding
// `seat-member`, or else the assembly (`motion.decider`); a mandate in it
// is issued by the assembly, or by another circle that may decide about
// it and holds `adopt-policy` by motion.
export async function proposing(db: Db, circle: string): Promise<Proposing | null> {
  const found = await db.query<{ name: string; decider: Deciding }>(
    `SELECT c.name, json_build_object('id', d.id, 'name', d.name, 'procedure', d.procedure) AS decider
     FROM circle.circle c
     JOIN circle.circle d ON d.id = motion.decider(c.id, ARRAY['seat-member'], cella.verdict_date())
     WHERE c.id = $1`,
    [circle],
  )
  if (!found.rows[0]) {
    return null
  }
  const circles = await db.query<{ id: string; name: string }>('SELECT id, name FROM circle.circle ORDER BY assembly DESC, name')
  const issuers = await db.query<Deciding>(
    `SELECT c.id, c.name, c.procedure FROM circle.circle c
     WHERE c.assembly OR (motion.decides(c.id, $1) AND circle.holds(c.id, 'adopt-policy', cella.verdict_date()))
     ORDER BY c.assembly DESC, c.name`,
    [circle],
  )
  const roles = await db.query<{ id: string; name: string }>(
    `SELECT r.id, r.name FROM circle.role r, circle.circle c
     WHERE c.id = $1 AND (r.circle = c.id OR (r.circle = '*' AND c.assembly)) ORDER BY r.circle = '*', r.name`,
    [circle],
  )
  const mandates = await db.query<Omit<Held, 'text'> & { wording: string }>(
    `SELECT m.policy, m.power || ' (' || coalesce(r.name, g.name) || ')' AS label,
            CASE WHEN r.id IS NULL THEN 'circle:' ELSE 'role:' END || m.grantee AS grantee, m.power,
            (cella.cents(m."limit") / 100.0)::float8 AS "limit", (cella.cents(m.budget) / 100.0)::float8 AS budget, m.per, m.scope,
            to_char(m."from", 'YYYY-MM-DD') AS "from", to_char(m.until, 'YYYY-MM-DD') AS until, m.issuer,
            coalesce(w.legal, '') AS wording
     FROM circle.mandate m
     LEFT JOIN circle.role r ON r.id = m.grantee
     LEFT JOIN circle.circle g ON g.id = m.grantee
     LEFT JOIN policy.wording w ON w.policy = m.policy
     WHERE (r.id = ANY($1) OR g.id = $2) AND (m.revoked IS NULL OR m.revoked > cella.verdict_date())
       AND (m.until IS NULL OR m.until > cella.verdict_date())
     ORDER BY r.id IS NULL, coalesce(r.name, g.name), m.power, m.id`,
    [roles.rows.map((r) => r.id), circle],
  )
  const open = await db.query<Proposing['open'][number]>(
    `SELECT m.motion, d.title, m.kind, to_char(d.deadline, 'YYYY-MM-DD') AS deadline
     FROM motion.circle_action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.circle = $1 AND d.closed IS NULL ORDER BY d.deadline, m.motion`,
    [circle],
  )
  return {
    circle,
    name: found.rows[0].name,
    decider: found.rows[0].decider,
    issuers: issuers.rows,
    circles: circles.rows,
    roles: roles.rows,
    mandates: mandates.rows.map(({ wording, ...m }) => ({ ...m, text: grants(wording) })),
    open: open.rows,
    policies: await inForce(db, circle),
    departures: await departures(db, circle),
    disclosure: await disclosing(db, circle),
  }
}

// A mandate as a motion's page names it: its power and grantee by name,
// who issued it, its cap in words, and the circle whose page lists it, a
// role every working circle has listed on the assembly's.
const mandateColumns = `m.id::text AS id, m.power, coalesce(r.name, g.name, m.grantee) AS grantee, m.issuer,
  circle.cap(m."limit", m.budget, m.per) AS cap, coalesce(nullif(r.circle, '*'), g.id, circle.assembly()) AS circle`

// What a motion's actions do to the mandates (`motion.issues`): each
// grant's mandate and parent, each end's or replacement's mandate and
// what its close revokes, each mandate as its page names it.
export async function issuing(db: Db, motion: string): Promise<{ mandates: Issuing[] }> {
  const { rows } = await db.query<{ n: number; kind: 'policy' | 'end'; closed: boolean; granted: string | null; parent: string | null; flaw: string | null; ends: string | null; revokes: string[] | null }>(
    'SELECT n, kind, closed, granted::text, parent::text, flaw, ends::text, revokes::text[] AS revokes FROM motion.issues($1)',
    [motion],
  )
  const ids = [...new Set(rows.flatMap((r) => [r.granted, r.parent, r.ends, ...(r.revokes ?? [])]))].filter((id): id is string => id !== null)
  const named = await db.query<Mandate>(
    `SELECT ${mandateColumns} FROM circle.mandate m
     LEFT JOIN circle.role r ON r.id = m.grantee LEFT JOIN circle.circle g ON g.id = m.grantee
     WHERE m.id = ANY($1::bigint[])`,
    [ids],
  )
  const by = new Map(named.rows.map((m) => [m.id, m]))
  const of = (id: string | null) => (id === null ? null : (by.get(id) ?? null))
  return {
    mandates: rows.map((r) => ({
      n: r.n,
      kind: r.kind,
      closed: r.closed,
      granted: of(r.granted),
      parent: of(r.parent),
      flaw: r.flaw,
      ends: of(r.ends),
      revokes: (r.revokes ?? []).map(of).filter((m): m is Mandate => m !== null),
    })),
  }
}

// On the assembly's page, open books' disclosure rule in force on the
// verdict date (`circle.disclosed`), with the motion that adopted it, or
// none standing; on any other circle's, nothing.
async function disclosing(db: Db, circle: string): Promise<Disclosure | null> {
  const { rows } = await db.query<{ assembly: boolean; policy: string | null; motion: string | null; from: string | null; contributors: number | null; largest: number | null; two: number | null }>(
    `SELECT c.assembly, d.policy, p.motion, to_char(p.applies, 'YYYY-MM-DD') AS "from",
            d.contributors, d.largest::float8 AS largest, d.two::float8 AS two
     FROM circle.circle c
     LEFT JOIN circle.disclosed(cella.verdict_date()) d ON true
     LEFT JOIN policy.policy p ON p.id = d.policy
     WHERE c.id = $1`,
    [circle],
  )
  const found = rows[0]
  if (!found?.assembly) {
    return null
  }
  const values = found.contributors === null || found.largest === null || found.two === null ? null : { contributors: found.contributors, largest: found.largest, two: found.two }
  return { policy: found.policy, motion: found.motion, from: found.from, values }
}
