import type { Outcome } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { canonical } from '@cella/org-body/models'
import type { actions } from '../models/actions.ts'
import type { Edit, Edited } from '../models/document.ts'
import { merged } from './loro.ts'

const op = 'document:document:edit' satisfies keyof typeof actions

// Appends a Loro update to the document's log. Confluent: Loro merges
// concurrent updates in any order, so no guard orders them. The update must
// import onto the draft and leave it a document of blocks, one with a
// canonical form; bytes that are not, are a fault of the caller, thrown
// rather than logged.
export async function edit(input: Edit, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Edited>> {
  const doc = await merged(deps.db, input.document)
  try {
    doc.import(input.update)
  } catch {
    throw new Error(`${input.document}: the edit is not a Loro update`)
  }
  try {
    canonical(doc)
  } catch (e) {
    throw new Error(`${input.document}: the edit leaves ${(e as Error).message}`)
  }
  let appended = 0
  let update = ''
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ receipt: string; digest: string; n: string; update: string }>(
        `INSERT INTO document.update (receipt, document, author, at, bytes)
         VALUES (cella.receipt(), $1, $2, cella.verdict_date(), $3)
         RETURNING receipt, encode(cella.digest(bytes), 'hex') AS digest, n, encode(bytes, 'hex') AS update`,
        [input.document, deps.actor, input.update],
      )
      appended = Number(rows[0].n)
      update = rows[0].update
      return { document: input.document, receipt: Number(rows[0].receipt), digest: rows[0].digest }
    },
    // The log keeps the update's bytes, in hex, the coop's text, and its
    // number, so the fold rebuilds it row for row.
    payload: (v) => ({ ...v, appended, update }),
  })
}
