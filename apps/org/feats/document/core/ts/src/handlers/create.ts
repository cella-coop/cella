import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { createDoc } from '../models/blocks.ts'
import { canonical } from '../models/canonical.ts'
import { paste } from '../models/edits.ts'
import type { Create, Created } from '../models/document.ts'

const op = 'document:document:create' satisfies keyof typeof ops

// A document's id from its title: lower case, unaccented, words joined by
// hyphens.
export const slug = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

// Starts a document, by its id or its title's slug, a taken one refused,
// and its draft's first update, its opening blocks, if it has any, as its
// author's edit. A graft that keeps a document for something of its own,
// as a meeting's minutes, runs this in its own write.
export const creating = (input: Create, author: string): Write<Created> => ({
  op,
  request: input,
  state: async (tx) => {
    const id = input.id ?? slug(input.title)
    if (!id) {
      throw new Error(`“${input.title}” names no document`)
    }
    const taken = await tx.query('SELECT FROM document.document WHERE id = $1', [id])
    if (taken.rowCount) {
      throw new Error(`a document ${id} exists already`)
    }
    await tx.query('INSERT INTO document.document (id, title) VALUES ($1, $2)', [id, input.title])
    if (!input.blocks?.length) {
      return { document: id, receipt: null, digest: null }
    }
    const doc = createDoc()
    paste(doc, undefined, 0, input.blocks)
    doc.commit()
    canonical(doc)
    const { rows } = await tx.query<{ receipt: string; digest: string }>(
      `INSERT INTO document.update (receipt, document, author, at, bytes)
       VALUES (cella.receipt(), $1, $2, cella.verdict_date(), $3)
       RETURNING receipt, encode(cella.digest(bytes), 'hex') AS digest`,
      [id, author, doc.export({ mode: 'update' })],
    )
    return { document: id, receipt: Number(rows[0].receipt), digest: rows[0].digest }
  },
  // The log commits to the opening update by its digest, never its bytes.
  payload: (v) => ({ ...v }),
})

export async function create(input: Create, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Created>> {
  return write(deps, creating(input, deps.actor))
}
