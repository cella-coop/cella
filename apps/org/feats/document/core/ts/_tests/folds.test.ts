// The document feat's folds (`sql/007-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// document folds started with its opening update, an edit appends its
// bytes, a version saves its snapshot and refuses a hash other than its
// entry's, a comment folds its text as its commitment, and an adoption
// and a generation rebuild their rows under the numbers their entries
// name. Run by `cella test slice document`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const camille = 'camille@folded.example'
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, date: string, payload: unknown) =>
  db.query(`SELECT document.${fn}($1)`, [{ n, op, actor: camille, date, cause: null, payload }])
const refused = async (run: () => Promise<unknown>, reason: RegExp) => {
  await db.query('SAVEPOINT s')
  try {
    await assert.rejects(run(), reason)
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT s')
  }
}

// A draft of one paragraph, then a second, as two Loro updates, and a
// snapshot of the whole, with the hash the database gives it.
const doc = createDoc()
edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text: 'The coop keeps its books open.' }], children: [] }])
doc.commit()
const opening = doc.export({ mode: 'update' })
const from = doc.version()
edits.paste(doc, undefined, 1, [{ type: 'paragraph', runs: [{ text: 'Every member reads them.' }], children: [] }])
doc.commit()
const edit = doc.export({ mode: 'update', from })
const snapshot = doc.export({ mode: 'snapshot' })
const frontier = doc.frontiers()
const vv = Object.fromEntries(doc.version().toJSON())

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) SELECT 'ag', 'ag' WHERE NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = 'ag')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a document folds started, edited, saved, commented on and adopted as its entries carry them', async () => {
  const digest = async (b: Uint8Array) => (await one<{ d: string }>(`SELECT encode(cella.digest($1::bytea), 'hex') AS d`, [Buffer.from(b)])).d
  await fold('fold_create', 1, 'document:document:create', '2041-01-10', {
    document: 'folded-rules', receipt: 1, digest: await digest(opening), title: 'Folded rules', circle: 'ag', appended: 9001, update: hex(opening),
  })
  await refused(
    () => fold('fold_edit', 2, 'document:document:edit', '2041-01-11', { document: 'folded-rules', receipt: 2, digest: '0'.repeat(64), appended: 9002, update: hex(edit) }),
    /entry 2 appends an update to folded-rules digested 0+, where its bytes digest/,
  )
  await fold('fold_edit', 2, 'document:document:edit', '2041-01-11', { document: 'folded-rules', receipt: 2, digest: await digest(edit), appended: 9002, update: hex(edit) })
  assert.deepEqual((await db.query(`SELECT n::int, receipt::int, author, to_char(at, 'YYYY-MM-DD') AS at, circle FROM document.update WHERE document = 'folded-rules' ORDER BY n`)).rows, [
    { n: 9001, receipt: 1, author: camille, at: '2041-01-10', circle: 'ag' },
    { n: 9002, receipt: 2, author: camille, at: '2041-01-11', circle: 'ag' },
  ])

  const { hash } = await one<{ hash: string }>(`SELECT encode(cella.document_hash($1), 'hex') AS hash`, [Buffer.from(snapshot)])
  const saved = (h: string) => ({ document: 'folded-rules', version: 'folded-rules@1', hash: h, n: 1, frontier, snapshot: hex(snapshot), vv })
  await refused(() => fold('fold_version', 3, 'document:document:version', '2041-01-12', saved('0'.repeat(64))), /entry 3 saves folded-rules@1 hashed 0+, where the fold hashes it/)
  await fold('fold_version', 3, 'document:document:version', '2041-01-12', saved(hash))
  const version = await one<{ id: string; saved: string; plain: string }>(`SELECT id, to_char(saved, 'YYYY-MM-DD') AS saved, plain FROM document.version WHERE document = 'folded-rules'`)
  assert.deepEqual(version, { id: 'folded-rules@1', saved: '2041-01-12', plain: 'The coop keeps its books open.\nEvery member reads them.' })

  await fold('fold_comment', 4, 'document:document:comment', '2041-01-13', { comment: 9003, version: 'folded-rules@1', quote: 'books open', anchor: null, text: { $commit: 'ab'.repeat(32) } })
  assert.deepEqual(await one(`SELECT author, text, anchor, resolved FROM document.comment WHERE id = 9003`), { author: camille, text: 'redacted', anchor: null, resolved: false })
  await fold('fold_comment', 41, 'document:document:comment', '2041-01-13', { comment: 9007, version: 'folded-rules@1', quote: null, anchor: null, text: { $commit: 'cd'.repeat(32) } })
  assert.deepEqual(await one(`SELECT quote, anchor FROM document.comment WHERE id = 9007`), { quote: null, anchor: null })
  await refused(
    () => fold('fold_comment', 42, 'document:document:comment', '2041-01-13', { comment: 9008, version: 'folded-rules@1', quote: 'books shut', anchor: null, text: { $commit: 'ef'.repeat(32) } }),
    /folded-rules@1 does not hold the quoted text/,
  )

  const adopt = (h: string) => ({ document: 'folded-rules', version: 'folded-rules@1', hash: h, adopted: '2041-01-14', receipt: 5, base: null, motion: 'm-2041-001', adoption: 9004 })
  await refused(() => fold('fold_adopt', 5, 'document:document:adopt', '2041-01-14', adopt('0'.repeat(64))), /entry 5 adopts folded-rules@1 hashed 0+, where the fold holds it hashed/)
  await fold('fold_adopt', 5, 'document:document:adopt', '2041-01-14', adopt(hash))
  assert.deepEqual(await one(`SELECT version, to_char(adopted, 'YYYY-MM-DD') AS adopted, receipt::int FROM document.adopted WHERE document = 'folded-rules'`), {
    version: 'folded-rules@1', adopted: '2041-01-14', receipt: 5,
  })
})

test('a generation folds its update, its version, what it cites and its adoption', async () => {
  await fold('fold_create', 6, 'document:document:create', '2041-02-01', { document: 'folded-statutes', receipt: null, digest: null, title: 'Folded statutes', circle: 'ag', appended: null, update: null })
  await db.query(`INSERT INTO document.generated (document, circle, template) VALUES ('folded-statutes', 'ag', '[]')`)
  const { hash } = await one<{ hash: string }>(`SELECT encode(cella.document_hash($1), 'hex') AS hash`, [Buffer.from(snapshot)])
  await fold('fold_generate', 7, 'document:document:generate', '2041-02-02', {
    document: 'folded-statutes', version: 'folded-statutes@1', hash, base: null, adopted: '2041-02-02', receipt: 7, policies: [], motion: 'm-2041-002', day: '2041-02-01',
    appended: 9005, update: hex(doc.export({ mode: 'update' })), n: 1, snapshot: hex(snapshot), frontier, vv, reads: '2041-02-01', adoption: 9006,
  })
  assert.deepEqual(await one(`SELECT n::int, receipt::int FROM document.update WHERE document = 'folded-statutes'`), { n: 9005, receipt: 7 })
  assert.deepEqual(await one(`SELECT version, motion, to_char(day, 'YYYY-MM-DD') AS day FROM document.generation WHERE document = 'folded-statutes'`), {
    version: 'folded-statutes@1', motion: 'm-2041-002', day: '2041-02-01',
  })
  assert.deepEqual(await one(`SELECT n::int, version, base FROM document.adoption WHERE document = 'folded-statutes'`), { n: 9006, version: 'folded-statutes@1', base: null })
})
