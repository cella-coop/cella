import { LoroDoc } from 'loro-crdt'
import type { Db } from '@cella/org-db'
import { body, type Frontier } from '../models/document.ts'

// The draft: every update the document holds, merged. Loro merges updates
// in any order to the same text, so receipt order is only for reading.
export async function merged(db: Db, document: string): Promise<LoroDoc> {
  const { rows } = await db.query<{ bytes: Uint8Array }>(
    'SELECT bytes FROM document.update WHERE document = $1 ORDER BY receipt',
    [document],
  )
  const doc = new LoroDoc()
  if (rows.length) {
    doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  }
  return doc
}

// The text of a Loro document, at a frontier or at its latest.
export function text(doc: LoroDoc, frontier?: Frontier): string {
  if (frontier) {
    doc.checkout(frontier)
  }
  const out = doc.getText(body).toString()
  doc.checkoutToLatest()
  return out
}

// The Loro update that turns the draft into `text`, as a plain text area
// edits it: Loro diffs the two texts into operations from a fresh peer. A
// browser sends a text area's lines ending in CRLF; the draft's end in LF.
export async function rewrite(db: Db, document: string, text: string): Promise<Uint8Array> {
  const doc = await merged(db, document)
  const from = doc.version()
  const next = text.replaceAll('\r\n', '\n')
  if (next === doc.getText(body).toString()) {
    throw new Error(`${document}: the draft already reads so; nothing to edit`)
  }
  doc.getText(body).update(next)
  doc.commit()
  return doc.export({ mode: 'update', from })
}

// The draft's text, merged from every update.
export async function draft(db: Db, document: string): Promise<string> {
  return text(await merged(db, document))
}
