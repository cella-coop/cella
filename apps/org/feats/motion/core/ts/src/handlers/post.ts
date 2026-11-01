import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Post, Posted } from '../models/thread.ts'

const op = 'motion:message:post' satisfies keyof typeof actions

// A message on a motion's deliberation, received now, as the acting
// member, perhaps answering another. A closed motion takes none, by the
// feat's trigger; `motion.posts` checks it is the actor's own and names
// what its payload does, and the grafts that each mention is a member and
// each link a document, and that the actor sits in the motion's circle.
// The text is the author's words and stays out of the log.
export async function post(input: Post, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ message: string }>(
        `INSERT INTO motion.message (receipt, motion, member, reply, body, mentions, links, at)
         VALUES (cella.receipt(), $1, $2, $3, $4, $5, $6, cella.verdict_date())
         RETURNING receipt AS message`,
        [input.motion, input.member, input.reply, input.body, input.mentions, input.links],
      )
      return { message: Number(rows[0].message) }
    },
    payload: (v) => ({
      motion: input.motion,
      member: input.member,
      message: v.message,
      reply: input.reply,
      mentions: input.mentions,
      links: input.links,
    }),
  })
}
