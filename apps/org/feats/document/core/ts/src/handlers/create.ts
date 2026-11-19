import type { Outcome } from '@cella/org-actions'
import { write, type Deps, type Write } from '@cella/org-db'
import { canonical, createDoc, edits } from '@cella/org-body/models'
import type { actions } from '../models/actions.ts'
import type { Create, Created } from '../models/document.ts'

const op = 'document:document:create' satisfies keyof typeof actions

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


// Starts a document in the circle it names, or the root's, by its id or
// its title's slug, a taken one refused, and its draft's first update,
// its opening blocks, if it has any, as its author's edit. A graft that
// keeps a document for something of its own, as a meeting's minutes,
// runs this in its own write, and folds it by `document.fold_creating`.
// Its entry carries the document's title and circle, and the opening
// update's number and bytes, in hex: the coop's text, which the fold
// rebuilds row for row.
export const creating = (input: Create, author: string): Write<Created> => {
  let made: { title: string; circle: string; appended: number | null; update: string | null } | undefined
  return {
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
      const started = await tx.query<{ circle: string }>(
        'INSERT INTO document.document (id, title, circle) VALUES ($1, $2, coalesce($3, circle.assembly())) RETURNING circle',
        [id, input.title, input.circle ?? null],
      )
      made = { title: input.title, circle: started.rows[0].circle, appended: null, update: null }
      if (!input.blocks?.length) {
        return { document: id, receipt: null, digest: null }
      }
      const doc = createDoc()
      edits.paste(doc, undefined, 0, input.blocks)
      doc.commit()
      canonical(doc)
      const { rows } = await tx.query<{ receipt: string; digest: string; n: string; update: string }>(
        `INSERT INTO document.update (receipt, document, author, at, bytes)
         VALUES (cella.receipt(), $1, $2, cella.verdict_date(), $3)
         RETURNING receipt, encode(cella.digest(bytes), 'hex') AS digest, n, encode(bytes, 'hex') AS update`,
        [id, author, doc.export({ mode: 'update' })],
      )
      made = { ...made, appended: Number(rows[0].n), update: rows[0].update }
      return { document: id, receipt: Number(rows[0].receipt), digest: rows[0].digest }
    },
    payload: (v) => ({ ...v, ...made }),
  }
}

export async function create(input: Create, deps: Deps): Promise<Outcome<(typeof actions)[typeof op], Created>> {
  return write(deps, creating(input, deps.actor))
}
