// Minutes, on a database holding the app's core, the document and
// meeting feats and this graft: minutes tie one meeting to one document,
// both existing, and `document_meeting.keeps` refuses a write naming
// other minutes than the meeting's. Run by `cella test slice
// document-meeting`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO document.document (id, title) VALUES ('minutes-ag-2026-06-20', 'Minutes'), ('rate-card-2027', 'Rate card 2027')`)
  await db.query(
    `INSERT INTO meeting.meeting (id, circle, title, at) VALUES
       ('ag-2026-06-20', 'ag', 'Assembly', '2026-06-20 10:00'),
       ('ag-2026-10-31', 'ag', 'Assembly', '2026-10-31 10:00')`,
  )
  await db.query(`INSERT INTO document_meeting.minutes (meeting, document) VALUES ('ag-2026-06-20', 'minutes-ag-2026-06-20')`)
})

after(async () => {
  await db.end()
})

test('minutes tie one meeting to one document, both existing', async () => {
  for (const [sql, says] of [
    [`INSERT INTO document_meeting.minutes (meeting, document) VALUES ('ag-2026-10-31', 'minutes-ag-2026-06-20')`, /minutes_document_key/],
    [`INSERT INTO document_meeting.minutes (meeting, document) VALUES ('ag-2026-06-20', 'rate-card-2027')`, /minutes_pkey/],
    [`INSERT INTO document_meeting.minutes (meeting, document) VALUES ('ag-2026-10-31', 'nothing')`, /no document nothing/],
    [`INSERT INTO document_meeting.minutes (meeting, document) VALUES ('nowhere', 'rate-card-2027')`, /no meeting nowhere/],
  ] as const) {
    await db.query('BEGIN')
    await assert.rejects(db.query(sql), says)
    await db.query('ROLLBACK')
  }
})

test('a write names the meeting\'s own minutes, or none', async () => {
  const keeps = async (payload: object) => (await db.query<{ r: string | null }>('SELECT document_meeting.keeps($1) AS r', [payload])).rows[0].r
  assert.equal(await keeps({ meeting: 'ag-2026-06-20', document: 'minutes-ag-2026-06-20' }), null)
  assert.equal(await keeps({ meeting: 'ag-2026-10-31' }), null)
  assert.equal(await keeps({ meeting: 'ag-2026-06-20', document: 'rate-card-2027' }), "ag-2026-06-20's minutes are not rate-card-2027")
})
