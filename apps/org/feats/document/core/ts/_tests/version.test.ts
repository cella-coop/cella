// The schema of a version: its canonical form, hash and text are
// generated from its snapshot, as core body's canonical form names it,
// and a version never changes; a comment quotes text its version holds.
// Run by `cella test slice document`, on a database holding the app's
// core and this feat alone.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { canonical, createDoc, edits, hash, jcs, plain } from '@cella/org-body/models'

const db = new pg.Client()

// A short card: a heading, and a rate a comment can quote.
function card() {
  const doc = createDoc(1)
  edits.paste(doc, undefined, 0, [
    { type: 'heading', level: 1, runs: [{ text: 'Rate card 2027' }], children: [] },
    { type: 'bullet', runs: [{ text: 'Solidarity: 380 €' }], children: [] },
  ])
  doc.commit()
  return doc
}

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a version is generated from its snapshot, numbered, and never changes', async () => {
  const doc = card()
  await db.query(`INSERT INTO document.document (id, title) VALUES ('card', 'Card')`)
  const { rows } = await db.query<{ id: string; hash: string; canonical: string; plain: string }>(
    `INSERT INTO document.version (document, saved, snapshot, frontier, vv) VALUES ('card', '2026-10-24', $1, '[]', '{}')
     RETURNING id, encode(hash, 'hex') AS hash, canonical, plain`,
    [doc.export({ mode: 'snapshot' })],
  )
  assert.equal(rows[0].id, 'card@1')
  assert.equal(rows[0].hash, hash(doc))
  assert.equal(rows[0].canonical, jcs(canonical(doc)))
  assert.equal(rows[0].plain, plain(canonical(doc)))
  await db.query('SAVEPOINT s')
  await assert.rejects(db.query(`UPDATE document.version SET saved = '2026-10-25' WHERE id = 'card@1'`), /never changes/)
  await db.query('ROLLBACK TO SAVEPOINT s')
  await assert.rejects(
    db.query(`INSERT INTO document.version (document, saved, snapshot, frontier, vv) VALUES ('card', '2026-10-24', '\\x010203', '[]', '{}')`),
    /no canonical form/,
  )
  await db.query('ROLLBACK TO SAVEPOINT s')
})

test('a comment quotes text its version holds', async () => {
  await db.query(`INSERT INTO document.comment (version, author, at, quote, text) VALUES ('card@1', 'malik@lanterne.example', '2026-10-24', 'Solidarity: 380 €', 'ok')`)
})

test('a comment that quotes nothing is on the document as a whole, and has no anchor', async () => {
  const { rows } = await db.query<{ quote: string | null; anchor: unknown }>(
    `INSERT INTO document.comment (version, author, at, quote, text) VALUES ('card@1', 'malik@lanterne.example', '2026-10-24', NULL, 'Is the card ready?')
     RETURNING quote, anchor`,
  )
  assert.deepEqual(rows[0], { quote: null, anchor: null })
  await db.query('SAVEPOINT s')
  await assert.rejects(
    db.query(`INSERT INTO document.comment (version, author, at, quote, anchor, text) VALUES ('card@1', 'malik@lanterne.example', '2026-10-24', NULL, '{"block":"b","from":"f","to":"t"}', 'no')`),
    /violates check constraint/,
  )
  await db.query('ROLLBACK TO SAVEPOINT s')
})

test('a comment quoting text its version does not hold is refused', async () => {
  await db.query('SAVEPOINT s')
  await assert.rejects(
    db.query(`INSERT INTO document.comment (version, author, at, quote, text) VALUES ('card@1', 'malik@lanterne.example', '2026-10-24', '9 999 €', 'no')`),
    /card@1 does not hold the quoted text/,
  )
  await db.query('ROLLBACK TO SAVEPOINT s')
  await assert.rejects(
    db.query(`INSERT INTO document.comment (version, author, at, quote, text) VALUES ('card@1', 'malik@lanterne.example', '2026-10-24', '', 'no')`),
    /violates check constraint/,
  )
  await db.query('ROLLBACK TO SAVEPOINT s')
})
