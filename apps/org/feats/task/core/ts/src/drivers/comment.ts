import type { Db, Read } from '@cella/org-db'
import type { Comment, Named } from '@cella/org-body/models'

// A task's comments, oldest first, each with its author's name, the
// names of those it mentions as they stand now, `redacted` once erased,
// and its reactions, each emoji given with its count and whether the
// reader gave it.
export async function comments(db: Db, task: string): Promise<Comment[]> {
  const { rows } = await db.query<Omit<Comment, 'id' | 'parent'> & { id: string; parent: string | null }>(
    `SELECT c.id, c.author, a.name, c.parent, c.text, to_char(c.posted, 'YYYY-MM-DD') AS posted,
            to_char(c.resolved, 'YYYY-MM-DD') AS resolved,
            coalesce((SELECT json_agg(json_build_object('person', m.person, 'name', p.name) ORDER BY m.n)
                      FROM task.mention m LEFT JOIN person.person p ON p.address = m.person
                      WHERE m.comment = c.id), '[]') AS mentions,
            coalesce((SELECT json_agg(json_build_object('emoji', r.emoji, 'count', r.count, 'mine', r.mine) ORDER BY r.emoji)
                      FROM (SELECT x.emoji, count(*)::int AS count, bool_or(x.person = cella.reader()) AS mine
                            FROM task.reaction x WHERE x.comment = c.id GROUP BY x.emoji) r), '[]') AS reactions
     FROM task.comment c LEFT JOIN person.person a ON a.address = c.author
     WHERE c.task = $1 ORDER BY c.id`,
    [task],
  )
  return rows.map((r) => ({ ...r, id: Number(r.id), parent: r.parent === null ? null : Number(r.parent) }))
}

// Who may read a task, whom a mention of it may name: each person, but
// one erased, holding `read` or `edit-task` over its circle today.
export async function readers(db: Db, task: string): Promise<Named[]> {
  const { rows } = await db.query<Named>(
    `SELECT p.address AS person, p.name FROM person.person p, task.task t
     WHERE t.id = $1 AND p.name <> 'redacted'
       AND (circle_person.may(p.address, 'read', NULL, t.circle, cella.verdict_date())
         OR circle_person.may(p.address, 'edit-task', NULL, t.circle, cella.verdict_date()))
     ORDER BY p.name, p.address`,
    [task],
  )
  return rows
}

// Whether the reader may discuss a task: post on it and resolve its
// threads, by `discuss` over its circle today.
export async function discusses(db: Db, task: string): Promise<boolean> {
  const { rows } = await db.query<{ may: boolean }>(
    `SELECT circle_person.may(cella.reader(), 'discuss', NULL, t.circle, cella.verdict_date()) AS may FROM task.task t WHERE t.id = $1`,
    [task],
  )
  return rows[0]?.may ?? false
}

// The mentions waiting on the reader, in their Inbox: each mention of
// them in a task's comment by someone else, in a thread not resolved,
// which they have not answered by a comment of their own in that thread
// since; in the order posted.
export const mentions: Read = {
  sql: `SELECT 'mention/task/' || c.id || '/' || m.n AS id, 'mention' AS kind,
               coalesce(a.name, c.author) || ' mentioned you on ' || t.title AS what, t.id AS about,
               to_char(c.posted, 'YYYY-MM-DD') AS since, NULL::text AS due,
               '/tasks/' || t.id AS href, c.id AS comment
        FROM task.mention m
        JOIN task.comment c ON c.id = m.comment
        JOIN task.task t ON t.id = c.task
        JOIN task.comment r ON r.id = coalesce(c.parent, c.id)
        LEFT JOIN person.person a ON a.address = c.author
        WHERE m.person = cella.reader() AND c.author <> cella.reader() AND r.resolved IS NULL
          AND NOT EXISTS (SELECT FROM task.comment y WHERE coalesce(y.parent, y.id) = r.id AND y.author = cella.reader() AND y.id > c.id)`,
  order: 'comment',
}

// Whether a task's comments take reactions: its circle's `reactions`
// setting, on unless a rule of the circle or the assembly turned it off.
export async function reacting(db: Db, task: string): Promise<boolean> {
  const { rows } = await db.query<{ taking: boolean }>(
    `SELECT circle.setting_of(t.circle, 'reactions') = 'on' AS taking FROM task.task t WHERE t.id = $1`,
    [task],
  )
  return rows[0]?.taking ?? false
}
