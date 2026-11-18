import type { Db } from '@cella/org-db'
import type { Shown } from '../models/changes.ts'

// The changes a motion's actions make, each as its diff shows it, for the
// kinds this graft carries out whose change reads as one: a circle's
// features arranged, as the tree from the one it replaces; a circle's
// terms and a role's amended, each term from the one in force. What each
// replaces is the value in force while the motion is open, and once it
// closed the one its effect's entry says it replaced (`was`), as
// `cella.disclosed` opens it to every reader since it commits to no one,
// or none where no effect of it stands, as a forgone one. A policy's text
// is no change of these: its diff is the policy register's to draw.
export async function changes(db: Db, motion: string): Promise<Shown[]> {
  const { rows } = await db.query<{
    n: number
    kind: 'arrange-features' | 'show-group' | 'hide-feature' | 'amend-circle' | 'amend-role'
    args: Record<string, string | number | null>
    open: boolean
    was: unknown
    now: Record<string, string | null> | null
    name: string | null
    what: string | null
  }>(
    `SELECT m.n::int AS n, m.kind, m.args, d.closed IS NULL AS open,
            CASE WHEN d.closed IS NOT NULL THEN (
              SELECT o -> 'was' FROM cella.log l, LATERAL (SELECT cella.disclosed(l.n) AS o) x
              WHERE l.n > coalesce((SELECT c.n FROM cella.log c WHERE c.receipt = d.cutoff AND c.op = 'motion:motion:close'), 0)
                AND l.op = CASE m.kind WHEN 'arrange-features' THEN 'circle:circle:arrange' WHEN 'show-group' THEN 'circle:circle:show' WHEN 'hide-feature' THEN 'circle:circle:hide' WHEN 'amend-circle' THEN 'circle:circle:amend' ELSE 'circle:role:amend' END
                AND o ->> 'motion' = d.id
                AND coalesce(o ->> 'role', o ->> 'circle') = coalesce(m.args ->> 'role', m.args ->> 'circle')
              ORDER BY l.n LIMIT 1) END AS was,
            CASE m.kind
              WHEN 'arrange-features' THEN (SELECT json_build_object('features', circle.features(c.id)) FROM circle.circle c WHERE c.id = m.args ->> 'circle')
              WHEN 'show-group' THEN json_build_object('shown', CASE WHEN EXISTS (SELECT FROM circle.shown s WHERE s.circle = m.args ->> 'circle' AND s."group" = m.args ->> 'group') THEN 'yes' ELSE 'no' END)
              WHEN 'hide-feature' THEN json_build_object('hidden', CASE WHEN EXISTS (SELECT FROM circle.hidden h WHERE h.circle = m.args ->> 'circle' AND h.feat = m.args ->> 'feature') THEN 'yes' ELSE 'no' END)
              WHEN 'amend-circle' THEN (SELECT json_build_object('name', c.name, 'purpose', c.purpose, 'procedure', c.procedure) FROM circle.circle c WHERE c.id = m.args ->> 'circle')
              ELSE (SELECT json_build_object('name', r.name, 'duty', r.duty, 'holders', r.holders::text) FROM circle.role r WHERE r.id = m.args ->> 'role')
            END AS now,
            CASE WHEN m.kind = 'amend-role' THEN (SELECT r.name FROM circle.role r WHERE r.id = m.args ->> 'role')
                 ELSE (SELECT c.name FROM circle.circle c WHERE c.id = m.args ->> 'circle') END AS name,
            coalesce((SELECT g.name FROM circle.feature_group g WHERE g.id = m.args ->> 'group'), m.args ->> 'group', m.args ->> 'feature') AS what
     FROM motion.action m JOIN motion.motion d ON d.id = m.motion
     WHERE m.motion = $1 AND m.kind IN ('arrange-features', 'show-group', 'hide-feature', 'amend-circle', 'amend-role')
     ORDER BY m.n`,
    [motion],
  )
  const terms: Record<string, string> = { name: 'name', purpose: 'purpose', procedure: 'procedure', duty: 'duty', holders: 'cap' }
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v))
  return rows.flatMap((r): Shown[] => {
    const who = r.name ?? String(r.args.circle ?? r.args.role ?? '')
    const before = (term: string): string | null => {
      if (r.open) {
        return r.now ? text(r.now[term]) : null
      }
      if (r.was === null || r.was === undefined) {
        return null
      }
      return typeof r.was === 'object' ? text((r.was as Record<string, unknown>)[term]) : text(r.was)
    }
    if (r.kind === 'arrange-features') {
      return [{ key: `${r.n}`, shape: 'arrangement', label: `${who}'s features`, was: before('features'), value: text(r.args.features) }]
    }
    if (r.kind === 'show-group') {
      return [{ key: `${r.n}`, shape: 'value', label: `${r.what} shown in ${who}`, was: before('shown'), value: text(r.args.shown) }]
    }
    if (r.kind === 'hide-feature') {
      return [{ key: `${r.n}`, shape: 'value', label: `${r.what} hidden in ${who}`, was: before('hidden'), value: text(r.args.hidden) }]
    }
    return Object.keys(terms)
      .filter((t) => t in r.args && !['circle', 'role'].includes(t))
      .map((t) => ({
        key: `${r.n}.${t}`,
        shape: 'value' as const,
        label: `${r.kind === 'amend-role' ? `The ${who} role` : who}'s ${terms[t]}`,
        was: before(t),
        value: r.args[t] === null ? 'none' : text(r.args[t]),
      }))
  })
}
