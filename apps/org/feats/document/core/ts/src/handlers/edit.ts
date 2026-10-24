import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Edit, Edited } from '../models/document.ts'
import { merged } from './loro.ts'

const op = 'document:document:edit' satisfies keyof typeof ops

// Appends a Loro update to the document's log. Confluent: Loro merges
// concurrent updates to one text in any order, so no rule orders them. The
// update must import onto the draft; bytes that are not a Loro update are
// a fault of the caller, thrown rather than logged.
export async function edit(input: Edit, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Edited>> {
  const doc = await merged(deps.db, input.document)
  try {
    doc.import(input.update)
  } catch {
    throw new Error(`${input.document}: the edit is not a Loro update`)
  }
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ receipt: string; digest: string }>(
        `INSERT INTO document.update (receipt, document, author, at, bytes)
         VALUES (cella.receipt(), $1, $2, cella.verdict_date(), $3)
         RETURNING receipt, encode(cella.digest(bytes), 'hex') AS digest`,
        [input.document, deps.actor, input.update],
      )
      return { document: input.document, receipt: Number(rows[0].receipt), digest: rows[0].digest }
    },
    // The log commits to the update by its digest, never its bytes.
    payload: (v) => ({ ...v }),
  })
}
