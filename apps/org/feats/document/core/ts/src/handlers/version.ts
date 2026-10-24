import type { Outcome } from '@cella/org-ops'
import { write, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { canonical, type Frontier, type Save, type Saved } from '../models/document.ts'
import { merged, text } from './loro.ts'

const op = 'document:document:version' satisfies keyof typeof ops

// Saves a version: the text at the frontier the saver read, or at the
// merged draft's, in canonical markdown, with its frontier and version
// vector. Confluent: two saves are two versions, numbered next in their
// document under a lock; the hash is the database's (`cella.digest`).
export async function version(input: Save, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Saved>> {
  return write(deps, {
    op,
    request: input,
    state: async (tx) => {
      const doc = await merged(tx, input.document)
      const frontier = (input.frontier ?? doc.frontiers()) as Frontier
      const vv = Object.fromEntries(doc.frontiersToVV(frontier).toJSON())
      const { rows } = await tx.query<{ id: string; n: number; hash: string }>(
        `INSERT INTO document.version (document, saved, body, frontier, vv)
         VALUES ($1, cella.verdict_date(), $2, $3, $4)
         RETURNING id, n, encode(hash, 'hex') AS hash`,
        [input.document, canonical(text(doc, frontier)), JSON.stringify(frontier), JSON.stringify(vv)],
      )
      return { version: rows[0].id, n: rows[0].n, hash: rows[0].hash, frontier }
    },
    payload: (v) => ({ document: input.document, version: v.version, hash: v.hash }),
  })
}
