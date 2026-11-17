import type { Db, Read } from '@cella/org-db'
import type { Comment, Named } from '@cella/org-body/models'
import type { Threaded } from '../models/comment.ts'

// A project's comments, oldest first, each with its author's name, the names
// of those it mentions as they stand now, `redacted` once erased, and its
// reactions, each emoji given with its count and whether the reader gave
// it.
export async function comments(db: Db, id: string): Promise<Comment[]> {
  const { rows } = await db.query<Omit<Comment, 'id' | 'parent'> & { id: string; parent: string | null }>(
    `SELECT c.id, c.author, a.name, c.parent, c.text, to_char(c.posted, 'YYYY-MM-DD') AS posted,
            to_char(c.resolved, 'YYYY-MM-DD') AS resolved,
            coalesce((SELECT json_agg(json_build_object('person', m.person, 'name', p.name) ORDER BY m.n)
                      FROM project.mention m LEFT JOIN person.person p ON p.address = m.person
                      WHERE m.comment = c.id), '[]') AS mentions,
            coalesce((SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.count, 'mine', r.mine) ORDER BY r.emoji)
                      FROM (SELECT x.emoji, count(*)::int AS count, bool_or(x.person = cella.reader()) AS mine
                            FROM project.reaction x WHERE x.comment = c.id GROUP BY x.emoji) r), '[]') AS reactions
     FROM project.comment c LEFT JOIN person.person a ON a.address = c.author
     WHERE c.project = $1 ORDER BY c.id`,
    [id],
  )
  return rows.map((r) => ({ ...r, id: Number(r.id), parent: r.parent === null ? null : Number(r.parent) }))
}

// Who may read a project, whom a mention of it may name: each person, but one
// erased, holding `read` over its circle today, or a power the feat's
// reads register.
export async function readers(db: Db, id: string): Promise<Named[]> {
  const { rows } = await db.query<Named>(
    `SELECT p.address AS person, p.name FROM person.person p, project.project t
     WHERE t.id = $1 AND p.name <> 'redacted'
       AND EXISTS (SELECT FROM unnest(ARRAY['read', 'manage-project', 'set-budget']) AS w (power)
                   WHERE circle_person.may(p.address, w.power, NULL, t.circle, cella.verdict_date()))
     ORDER BY p.name, p.address`,
    [id],
  )
  return rows
}

// Whether the reader may discuss a project, by `discuss` over its circle
// today, and whether its comments take reactions, by its circle's
// `reactions` setting.
async function may(db: Db, id: string): Promise<{ discuss: boolean; reactions: boolean }> {
  const { rows } = await db.query<{ discuss: boolean; reactions: boolean }>(
    `SELECT circle_person.may(cella.reader(), 'discuss', NULL, t.circle, cella.verdict_date()) AS discuss,
            circle.setting_of(t.circle, 'reactions') = 'on' AS reactions
     FROM project.project t WHERE t.id = $1`,
    [id],
  )
  return rows[0] ?? { discuss: false, reactions: false }
}

// A project's threads as its page reads them. Who may be mentioned is
// edit-time data, read separately by the comment box once it mounts.
export async function threaded(db: Db, id: string): Promise<Threaded> {
  return { comments: await comments(db, id), ...(await may(db, id)) }
}

// The mentions waiting on the reader, in their Inbox: each mention of them
// in a project's comment by someone else, in a thread not resolved, which
// they have not answered by a comment of their own in that thread since;
// in the order posted.
export const mentions: Read = {
  sql: `SELECT 'mention/project/' || c.id || '/' || m.n AS id, 'mention' AS kind,
               coalesce(a.name, c.author) || ' mentioned you on ' || t.title AS what, t.id AS about,
               to_char(c.posted, 'YYYY-MM-DD') AS since, NULL::text AS due,
               '/projects/' || t.id AS href, c.id AS comment
        FROM project.mention m
        JOIN project.comment c ON c.id = m.comment
        JOIN project.project t ON t.id = c.project
        JOIN project.comment r ON r.id = coalesce(c.parent, c.id)
        LEFT JOIN person.person a ON a.address = c.author
        WHERE m.person = cella.reader() AND c.author <> cella.reader() AND r.resolved IS NULL
          AND NOT EXISTS (SELECT FROM project.comment y WHERE coalesce(y.parent, y.id) = r.id AND y.author = cella.reader() AND y.id > c.id)`,
  order: 'comment',
}
