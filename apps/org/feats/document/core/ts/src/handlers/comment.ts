import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Comment, Commented } from '../models/document.ts'

const op = 'document:document:comment' satisfies keyof typeof ops

// Comments on a version, anchored by the text it quotes. Confluent;
// `document.quotes` still refuses a quote the version does not hold.
export async function comment(input: Comment, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Commented>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO document.comment (version, author, at, quote, text)
         VALUES ($1, $2, cella.verdict_date(), $3, $4)
         RETURNING id`,
        [input.version, deps.actor, input.quote, input.text],
      )
      return { comment: Number(rows[0].id), version: input.version }
    },
    // The comment's words may be personal; the log holds where it is.
    payload: (v) => ({ ...v }),
  })
}
