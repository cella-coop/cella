import type { Db } from '@cella/org-db'
import { canonical, createDoc, type Canon, type LoroDoc } from '@cella/org-body/models'
import type { Frontier } from '../models/document.ts'

// The draft: every update the document holds, merged. Loro merges updates
// in any order to the same document, so receipt order is only for reading.
export async function merged(db: Db, document: string): Promise<LoroDoc> {
  const { rows } = await db.query<{ bytes: Uint8Array }>(
    'SELECT bytes FROM document.update WHERE document = $1 ORDER BY receipt, n',
    [document],
  )
  const doc = createDoc()
  if (rows.length) {
    doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  }
  return doc
}

// A snapshot of the document as it stood at a frontier: what a version
// keeps, and what the database canonicalises and hashes.
export function snapshot(doc: LoroDoc, frontier?: Frontier): Uint8Array {
  const at = frontier ? doc.forkAt(frontier) : doc
  return at.export({ mode: 'snapshot' })
}

// The draft's canonical form, merged from every update.
export async function draft(db: Db, document: string): Promise<Canon> {
  return canonical(await merged(db, document))
}
