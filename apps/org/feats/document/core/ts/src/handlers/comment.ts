import type { Outcome } from '@cella/org-actions'
import { personal, write, type Deps } from '@cella/org-db'
import { anchor, createDoc } from '@cella/org-body/models'
import type { actions } from '../models/actions.ts'
import type { Comment, Commented } from '../models/document.ts'

const op = 'document:document:comment' satisfies keyof typeof actions

// Comments on a version, on the text it quotes, anchored by Loro cursors
// at the quote's ends when one block of the version holds it. Confluent;
// `document.quotes` still refuses a quote the version does not hold. Its
// text is its author's words: the log commits to it and the vault keeps
// it; the quote, the version's own text, and the anchor the log keeps as
// they are.
export async function comment(input: Comment, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Commented>> {
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
    payload: (v) => ({
      ...v,
      quote: input.quote,
      anchor: where,
      text: personal('document.comment.text', deps.actor, input.text),
    }),
  })
}
