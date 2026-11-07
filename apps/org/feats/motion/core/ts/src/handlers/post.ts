import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import type { actions } from '../models/actions.ts'
import type { Post, Posted } from '../models/thread.ts'

const op = 'motion:message:post' satisfies keyof typeof actions

// A message on a motion's deliberation, received now, as the acting
// member, perhaps answering another. A closed motion takes none, by the
// feat's trigger; the table generates the handles it mentions and the
// documents it links from its text, and those are what it submits; it
// signs the fields it reads, so a request naming its own reads as none;
// `motion.posts` checks it is the actor's own and names what its payload
// does, and the grafts that each mention is a member and each link a
// document, and that the actor sits in the motion's circle. The text is
// the author's words: the log commits to it and the vault keeps it.
export async function post(input: Post, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Posted>> {
  return write(deps, {
    op,
    request: { motion: input.motion, member: input.member, reply: input.reply, body: input.body },
    state: async (tx) => {
      const { rows } = await tx.query<{ message: string; mentions: string[]; links: string[] }>(
        `INSERT INTO motion.message (receipt, motion, member, reply, body, at)
         VALUES (cella.receipt(), $1, $2, $3, $4, cella.verdict_date())
         RETURNING receipt AS message, mentions, links`,
        [input.motion, input.member, input.reply, input.body],
      )
      return { message: Number(rows[0].message), mentions: rows[0].mentions, links: rows[0].links }
    },
    payload: (v) => ({
      motion: input.motion,
      member: input.member,
      message: v.message,
      reply: input.reply,
      body: personal('motion.message.body', input.member, input.body),
      mentions: v.mentions,
      links: v.links,
    }),
  })
}
