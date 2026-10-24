import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { createDoc } from '../models/blocks.ts'
import { anchor } from '../models/anchor.ts'
import type { Comment, Commented } from '../models/document.ts'

const op = 'document:document:comment' satisfies keyof typeof ops

// Comments on a version, on the text it quotes, anchored by Loro cursors
// at the quote's ends when one block of the version holds it. Confluent;
// `document.quotes` still refuses a quote the version does not hold.
export async function comment(input: Comment, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Commented>> {
  const { rows } = await deps.db.query<{ snapshot: Uint8Array }>('SELECT snapshot FROM document.version WHERE id = $1', [input.version])
  let where = null
  if (rows[0]) {
    const doc = createDoc()
    doc.import(new Uint8Array(rows[0].snapshot))
    where = anchor(doc, input.quote)
  }
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO document.comment (version, author, at, quote, anchor, text)
         VALUES ($1, $2, cella.verdict_date(), $3, $4, $5)
         RETURNING id`,
        [input.version, deps.actor, input.quote, where && JSON.stringify(where), input.text],
      )
      return { comment: Number(rows[0].id), version: input.version }
    },
    // The comment's words may be personal; the log holds where it is.
    payload: (v) => ({ ...v }),
  })
}
