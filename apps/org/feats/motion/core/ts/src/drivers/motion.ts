import type { Db, Read } from '@cella/org-db'
import { leftBy } from '@cella/org-policy'
import type { Motion, Detail, Effect, Given, Kind, Labelled, Procedure, Summary } from '../models/motion.ts'
import type { Message } from '../models/thread.ts'

// Its author by its grantee's name, a role's or a circle's, or its id
// where its reader reads neither.
const columns = `id, circle, author,
  coalesce((SELECT r.name FROM circle.role r WHERE r.id = motion.author),
           (SELECT c.name FROM circle.circle c WHERE c.id = motion.author), motion.author) AS "authorName",
  title, method, procedure, ballot, to_char(proposed, 'YYYY-MM-DD') AS proposed,
  to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed`

// The motions as the collection lists them, open first, then the
// latest proposed.
export const listing: Read = {
  sql: `SELECT ${columns} FROM motion.motion`,
  order: 'closed IS NOT NULL, proposed DESC, id DESC',
}

// Open motions first, then the latest proposed.
export async function motions(db: Db): Promise<Motion[]> {
  const { rows } = await db.query<Motion>(`SELECT ${columns} FROM motion.motion ORDER BY closed IS NOT NULL, proposed DESC, id DESC`)
  return rows
}

// A motion, its proposal, every stance given on it, newest first, its
// deliberation in the order received, the defaults its actions left, and
// what its close carried.
export async function motion(db: Db, id: string): Promise<Detail | null> {
  const found = await db.query<Omit<Detail, 'terms' | 'leaves' | 'close' | 'effects'>>(`SELECT ${columns}, body, cutoff::int AS cutoff FROM motion.motion WHERE id = $1`, [id])
  if (!found.rows[0]) {
    return null
  }
  // Its procedure by its id, whether or not its policy is in force now or
  // its reader reads the register, which is the members'.
  const procedure = (await db.query<Procedure>(`SELECT ${procedureColumns} FROM motion.procedure o WHERE o.id = $1`, [found.rows[0].procedure])).rows[0]
  if (!procedure) {
    throw new Error(`${id} is taken by ${found.rows[0].procedure}, which is no procedure`)
  }
  // Its terms are its procedure's, by the ballot it was proposed under.
  const terms = { ...procedure, ballot: found.rows[0].ballot }
  const given = await db.query<Given>(
    `SELECT receipt::text AS id, receipt::int AS receipt, member, stance, to_char(at, 'YYYY-MM-DD') AS at
     FROM motion.vote WHERE motion = $1 ORDER BY receipt DESC`,
    [id],
  )
  const actions = await db.query<Labelled>(
    `SELECT m.n::text AS id, m.n, m.kind, k.label, k.fields, m.args
     FROM motion.action m JOIN motion.carries k ON k.kind = m.kind
     WHERE m.motion = $1 ORDER BY m.n`,
    [id],
  )
  const messages = await db.query<Message>(
    `SELECT receipt::int AS receipt, member, reply::int AS reply, body, mentions, links, to_char(at, 'YYYY-MM-DD') AS at
     FROM motion.message WHERE motion = $1 ORDER BY receipt`,
    [id],
  )
  return {
    ...found.rows[0],
    terms,
    given: given.rows,
    actions: actions.rows,
    messages: messages.rows,
    leaves: await leftBy(db, id),
    ...(await effects(db, found.rows[0].cutoff)),
  }
}

// A procedure's terms, as a motion is taken by them.
const procedureColumns = `id, label, method,
  CASE WHEN share_num IS NULL THEN NULL ELSE json_build_array(share_num, share_den) END AS share,
  json_build_array(quorum_num, quorum_den) AS quorum, ballot, motion.consults(o.id) AS consult`

// The procedures a motion may be taken by, the built-in ones first: those
// whose policy is in force, or which name none.
export async function procedures(db: Db): Promise<Procedure[]> {
  const { rows } = await db.query<Procedure>(
    `SELECT ${procedureColumns}
     FROM motion.procedure o
     WHERE o.policy IS NULL OR EXISTS (
       SELECT FROM policy.policy r
       WHERE r.id = o.policy AND r.applies <= cella.verdict_date() AND (r.ends IS NULL OR r.ends > cella.verdict_date())
     )
     ORDER BY id NOT IN ('consent', 'majority', 'two-thirds', 'election'), label`,
  )
  return rows
}

// Every motion of the scope, the latest first, as a card draws it and a
// graft offers it: an embed in a document, a motion an agenda tables;
// a picker that searches replaces the list when they are many.
export async function summaries(db: Db): Promise<Summary[]> {
  const { rows } = await db.query<Summary>(
    `SELECT id, title, circle, method, to_char(deadline, 'YYYY-MM-DD') AS deadline, to_char(closed, 'YYYY-MM-DD') AS closed
     FROM motion.motion ORDER BY proposed DESC, id DESC`,
  )
  return rows
}

// The kinds of action the grafts register, by label.
export async function kinds(db: Db): Promise<Kind[]> {
  const { rows } = await db.query<Kind>('SELECT kind, label, fields FROM motion.carries ORDER BY label')
  return rows
}

// The effects a motion's close carried, from the log: its close's entry,
// the decision whose receipt is the motion's cutoff, and every entry after
// it and before the next decision's, since a write's entries are
// consecutive and each effect follows the decision or an earlier effect.
// An effect is named by the label of the kind whose op it is, where
// `motion.carries` registers one. A forgone one's reason is in its logged
// payload, which `cella.disclosed` opens to the reader who may read it.
export async function effects(db: Db, cutoff: number | null): Promise<{ close: number | null; effects: Effect[] }> {
  if (cutoff === null) {
    return { close: null, effects: [] }
  }
  const close = await db.query<{ n: number }>(`SELECT n::int AS n FROM cella.log WHERE receipt = $1 AND op = 'motion:motion:close'`, [cutoff])
  const n = close.rows[0]?.n
  if (n === undefined) {
    return { close: null, effects: [] }
  }
  const { rows } = await db.query<Effect>(
    `WITH next AS (SELECT min(d.n) AS n FROM cella.log d WHERE d.n > $1 AND d.receipt IS NOT NULL)
     SELECT l.n::text AS id, l.n::int AS entry, l.op, l.cause::int AS follows, l.settled,
            (SELECT k.label FROM motion.carries k WHERE k.op = l.op ORDER BY k.kind LIMIT 1) AS label,
            CASE WHEN l.settled THEN NULL ELSE cella.disclosed(l.n) ->> 'reason' END AS reason
     FROM cella.log l, next
     WHERE l.n > $1 AND (next.n IS NULL OR l.n < next.n)
     ORDER BY l.n`,
    [n],
  )
  return { close: n, effects: rows }
}
