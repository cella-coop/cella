import type { Db } from '@cella/org-db'
import type { Decision, Detail, Given, Kind, Motioned, Summary } from '../models/decision.ts'

const columns = `id, circle, title, rule, to_char(proposed, 'YYYY-MM-DD') AS proposed,
  to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed`

// Open decisions first, then the latest proposed.
export async function decisions(db: Db): Promise<Decision[]> {
  const { rows } = await db.query<Decision>(`SELECT ${columns} FROM decision.decision ORDER BY closed IS NOT NULL, proposed DESC, id DESC`)
  return rows
}

// A decision, its proposal and every stance given on it, newest first.
export async function decision(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Detail>(`SELECT ${columns}, body, cutoff::int AS cutoff FROM decision.decision WHERE id = $1`, [id])
  if (!found.rows[0]) {
    return null
  }
  const given = await db.query<Given>(
    `SELECT receipt::text AS id, receipt::int AS receipt, member, stance, to_char(at, 'YYYY-MM-DD') AS at
     FROM decision.vote WHERE decision = $1 ORDER BY receipt DESC`,
    [id],
  )
  const motions = await db.query<Motioned>(
    `SELECT m.n::text AS id, m.n, m.kind, k.label, m.args
     FROM decision.motion m JOIN decision.kind k ON k.kind = m.kind
     WHERE m.decision = $1 ORDER BY m.n`,
    [id],
  )
  return { ...found.rows[0], given: given.rows, motions: motions.rows }
}

// Every decision of the scope, the latest first, as a card draws it and a
// graft offers it: an embed in a document, a decision an agenda tables;
// a picker that searches replaces the list when they are many.
export async function summaries(db: Db): Promise<Summary[]> {
  const { rows } = await db.query<Summary>(
    `SELECT id, title, circle, rule, to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed
     FROM decision.decision ORDER BY proposed DESC, id DESC`,
  )
  return rows
}

// The kinds of motion the grafts register, by label.
export async function kinds(db: Db): Promise<Kind[]> {
  const { rows } = await db.query<Kind>('SELECT kind, label, fields FROM decision.kind ORDER BY label')
  return rows
}
