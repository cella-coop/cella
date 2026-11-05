import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import { departures, inOrder } from '@cella/org-policy'
import type { actions } from '../models/actions.ts'
import type { Fragment } from '../models/edits.ts'
import { patch } from '../models/edits.ts'
import { fill } from '../models/generated.ts'
import type { Frontier, Generate, Generated } from '../models/document.ts'
import { merged, snapshot } from './loro.ts'

const op = 'document:document:generate' satisfies keyof typeof actions

// Generates a generated document anew from its circle's policies in force
// on the day it reads, in their order, and the defaults of its form the
// circle left or never took, around its template, and freezes it: the
// generated blocks are patched onto the draft, keeping the blocks that
// still read the same, and what changed is appended as an update by the
// actor; the result is saved as the next version, citing the motion and
// the day it reads, and adopted on the verdict date, from the adopted
// version before it, in one write whose log entry commits to the
// version's hash. The day it reads is `document.reads`'s, the later of
// the day the motion's change applies and the day the adopted version
// reads, so a generation never goes back. The guards decide:
// `document.adopts`, that the base is still the adopted version;
// `document.generates`, that no version before the adopted one cites the
// motion, that it changed the circle's policies that day and that the
// version reads those in force on the day it reads; the grafts', that the
// motion closed and passed. A graft runs it once a motion's adoption or
// ending of a policy settles.
export const generating = (input: Generate, author: string): Write<Generated> => ({
  op,
  request: input,
  state: async (tx) => {
    const found = await tx.query<{ circle: string; template: Fragment[] }>('SELECT circle, template FROM document.generated WHERE document = $1', [input.document])
    const g = found.rows[0]
    if (!g) {
      throw new Error(`${input.document} is not generated from policies`)
    }
    const reads = await tx.query<{ day: string | null }>(
      `SELECT to_char(document.reads((SELECT a.version FROM document.adopted a WHERE a.document = $1), $2::date), 'YYYY-MM-DD') AS day`,
      [input.document, input.day],
    )
    const day = reads.rows[0].day ?? input.day
    const policies = await inOrder(tx, g.circle, day)
    const doc = await merged(tx, input.document)
    const from = doc.version()
    patch(doc, undefined, fill(g.template, policies, await departures(tx, g.circle, day)))
    doc.commit()
    const update = doc.export({ mode: 'update', from })
    if (doc.version().compare(from) !== 0) {
      await tx.query(
        `INSERT INTO document.update (receipt, document, author, at, bytes) VALUES (cella.receipt(), $1, $2, cella.verdict_date(), $3)`,
        [input.document, author, update],
      )
    }
    const frontier = doc.frontiers() as Frontier
    const saved = await tx.query<{ id: string; hash: string }>(
      `INSERT INTO document.version (document, saved, snapshot, frontier, vv)
       VALUES ($1, cella.verdict_date(), $2, $3, $4)
       RETURNING id, encode(hash, 'hex') AS hash`,
      [input.document, snapshot(doc), JSON.stringify(frontier), JSON.stringify(Object.fromEntries(doc.version().toJSON()))],
    )
    const v = saved.rows[0]
    await tx.query(
      `INSERT INTO document.generation (document, version, motion, day) VALUES ($1, $2, $3, $4)`,
      [input.document, v.id, input.motion, day],
    )
    const adopted = await tx.query<{ receipt: string; adopted: string; base: string | null }>(
      `INSERT INTO document.adoption (receipt, document, version, base, adopted)
       VALUES (cella.receipt(), $1, $2, (SELECT a.version FROM document.adopted a WHERE a.document = $1), cella.verdict_date())
       RETURNING receipt, to_char(adopted, 'YYYY-MM-DD') AS adopted, base`,
      [input.document, v.id],
    )
    const a = adopted.rows[0]
    return { document: input.document, version: v.id, hash: v.hash, base: a.base, adopted: a.adopted, receipt: Number(a.receipt), policies: policies.map((p) => p.id) }
  },
  payload: (v) => ({ ...v, motion: input.motion, day: input.day }),
})

export async function generate(input: Generate, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Generated>> {
  return write(deps, generating(input, deps.actor))
}
