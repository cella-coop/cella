import type { Db, Read } from '@cella/org-db'
import type { Decision, Detail, Given, Kind, Motioned, Procedure, Summary } from '../models/decision.ts'
import type { Message } from '../models/thread.ts'

const columns = `id, circle, title, rule, procedure, to_char(proposed, 'YYYY-MM-DD') AS proposed,
  to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed`

// The decisions as the collection lists them, open first, then the
// latest proposed.
export const listing: Read = {
  sql: `SELECT ${columns} FROM decision.decision`,
  order: 'closed IS NOT NULL, proposed DESC, id DESC',
}

// Open decisions first, then the latest proposed.
export async function decisions(db: Db): Promise<Decision[]> {
  const { rows } = await db.query<Decision>(`SELECT ${columns} FROM decision.decision ORDER BY closed IS NOT NULL, proposed DESC, id DESC`)
  return rows
}

// A decision, its proposal, every stance given on it, newest first, and
// its deliberation in the order received.
export async function decision(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Omit<Detail, 'terms'>>(`SELECT ${columns}, body, cutoff::int AS cutoff FROM decision.decision WHERE id = $1`, [id])
  if (!found.rows[0]) {
    return null
  }
  const terms = (await procedures(db)).find((p) => p.id === found.rows[0].procedure)
  if (!terms) {
    throw new Error(`${id} is taken by ${found.rows[0].procedure}, which is no procedure`)
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
  const messages = await db.query<Message>(
    `SELECT receipt::int AS receipt, member, reply::int AS reply, body, mentions, links, to_char(at, 'YYYY-MM-DD') AS at
     FROM decision.message WHERE decision = $1 ORDER BY receipt`,
    [id],
  )
  return { ...found.rows[0], terms, given: given.rows, motions: motions.rows, messages: messages.rows }
}

// The procedures a decision may be taken by, the built-in ones first.
export async function procedures(db: Db): Promise<Procedure[]> {
  const { rows } = await db.query<Procedure>(
    `SELECT id, label, rule,
            CASE WHEN share_num IS NULL THEN NULL ELSE json_build_array(share_num, share_den) END AS share,
            json_build_array(quorum_num, quorum_den) AS quorum
     FROM decision.procedure
     ORDER BY id NOT IN ('consent', 'majority', 'two-thirds'), label`,
  )
  return rows
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
