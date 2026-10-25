import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Post, Posted } from '../models/thread.ts'

const op = 'decision:message:post' satisfies keyof typeof ops

// A message on a decision's deliberation, received now, as the acting
// member, perhaps answering another. A closed decision takes none, by the
// feat's trigger; `decision.posts` checks it is the actor's own and names
// what its payload does, and the grafts that each mention is a member and
// each link a document, and that the actor sits in the decision's circle.
// The text is the author's words and stays out of the log.
export async function post(input: Post, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Posted>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ message: string }>(
        `INSERT INTO decision.message (receipt, decision, member, reply, body, mentions, links, at)
         VALUES (cella.receipt(), $1, $2, $3, $4, $5, $6, cella.verdict_date())
         RETURNING receipt AS message`,
        [input.decision, input.member, input.reply, input.body, input.mentions, input.links],
      )
      return { message: Number(rows[0].message) }
    },
    payload: (v) => ({
      decision: input.decision,
      member: input.member,
      message: v.message,
      reply: input.reply,
      mentions: input.mentions,
      links: input.links,
    }),
  })
}
