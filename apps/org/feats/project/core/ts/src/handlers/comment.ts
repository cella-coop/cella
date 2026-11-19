import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { thread } from '@cella/org-body/models'
import type { actions } from '../models/actions.ts'
import type { CommentDone, CommentPost, CommentPosted, CommentReact, CommentResolve } from '../models/comment.ts'

type Action = keyof typeof actions
type Out<O extends Action, T> = Promise<Outcome<(typeof actions)[O], T>>

// Posts a comment on a project as the actor, under its write's receipt, in
// the project's circle, which the payload names for the power's guard: a
// root, or a reply to a root, which reopens it. Each `@[address]` its
// text gives is a mention, a row each in the order given, of a person the
// coop knows; `project.posts` refuses a reply to a reply, naming the root, a
// mention of no one, and a post naming otherwise than its rows. The text
// is its author's free text, and the log keeps it as written.
export async function postComment(input: CommentPost, deps: Deps): Out<'project:comment:post', CommentPosted> {
  const mentions = thread.mentioned(input.text)
  return write(deps, {
    op: 'project:comment:post' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string; circle: string }>(
        `INSERT INTO project.comment (id, project, author, parent, text, posted)
         VALUES (cella.receipt(), $1, $2, $3, $4, cella.verdict_date())
         RETURNING id, circle`,
        [input.project, deps.actor, input.parent, input.text],
      )
      const comment = Number(rows[0].id)
      for (const [i, person] of mentions.entries()) {
        await tx.query(
          'INSERT INTO project.mention (comment, n, person) SELECT $1, $2, $3 WHERE EXISTS (SELECT FROM person.person WHERE address = $3)',
          [comment, i + 1, person],
        )
      }
      if (input.parent !== null) {
        await tx.query('UPDATE project.comment SET resolved = NULL WHERE id = $1 AND resolved IS NOT NULL', [input.parent])
      }
      return { project: input.project, comment, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, parent: input.parent, text: input.text, mentions }),
  })
}

// Resolves a project's root comment on the verdict date, or reopens it; the
// last write wins. `project.resolves` refuses a reply, naming its root.
export async function resolveComment(input: CommentResolve, deps: Deps): Out<'project:comment:resolve', CommentDone> {
  return write(deps, {
    op: 'project:comment:resolve' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ project: string; circle: string }>(
        `UPDATE project.comment SET resolved = CASE WHEN parent IS NULL AND $2 THEN cella.verdict_date() END
         WHERE id = $1 RETURNING project, circle`,
        [input.comment, input.resolved],
      )
      if (!rows[0]) {
        throw new Error(`no comment ${input.comment}`)
      }
      return { comment: input.comment, project: rows[0].project, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, resolved: input.resolved }),
  })
}

// Turns the actor's reaction to a project's comment on or off; the last write
// wins. `project.reacts` refuses an emoji not of core body's six, and any
// reaction where the comment's circle has `reactions` off, naming the
// circle and the rule that turned them off.
export async function reactToComment(input: CommentReact, deps: Deps): Out<'project:comment:react', CommentDone> {
  return write(deps, {
    op: 'project:comment:react' satisfies Action,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ project: string; circle: string }>('SELECT project, circle FROM project.comment WHERE id = $1', [input.comment])
      if (!rows[0]) {
        throw new Error(`no comment ${input.comment}`)
      }
      if (input.on) {
        await tx.query('INSERT INTO project.reaction (comment, person, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
          input.comment,
          deps.actor,
          input.emoji,
        ])
      } else {
        await tx.query('DELETE FROM project.reaction WHERE comment = $1 AND person = $2 AND emoji = $3', [input.comment, deps.actor, input.emoji])
      }
      return { comment: input.comment, project: rows[0].project, circle: rows[0].circle }
    },
    payload: (v) => ({ ...v, emoji: input.emoji, on: input.on }),
  })
}
