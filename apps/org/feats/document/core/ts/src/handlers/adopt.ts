import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Adopt, Adopted } from '../models/document.ts'

const op = 'document:document:adopt' satisfies keyof typeof ops

// Makes a version binding, on the verdict date. The rules on this op
// decide: `document.adopts`, that the version is the document's and its
// base is still the adopted version; the grafts', that the cited decision
// asks for it, closed and passed.
export async function adopt(input: Adopt, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Adopted>> {
  return write(deps, {
    op,
    state: async (tx) => {
      const { rows } = await tx.query<{ receipt: string; adopted: string }>(
        `INSERT INTO document.adoption (receipt, document, version, base, adopted)
         VALUES (cella.receipt(), $1, $2, $3, cella.verdict_date())
         RETURNING receipt, to_char(adopted, 'YYYY-MM-DD') AS adopted`,
        [input.document, input.version, input.base],
      )
      return { document: input.document, version: input.version, adopted: rows[0].adopted, receipt: Number(rows[0].receipt) }
    },
    payload: (v) => ({ ...v, base: input.base, decision: input.decision }),
  })
}
