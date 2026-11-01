// A member's reading, on a database holding the app's core, the document
// and member feats and this graft: the texts each member is to read are
// every document's binding version, a later adoption asking a new
// reading; and `document_membership.reads`, that a reading is the actor's
// own, of a version that exists. Run by `cella test slice document-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const lea = 'lea@lanterne.example'

const all = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows as R[]
const reads = async (payload: object) => (await all<{ r: string | null }>('SELECT document_membership.reads($1) AS r', [payload]))[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, shares, invited) VALUES ($1, 'invited', 0, '2026-09-30')`, [ines])
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Léa Bernard') ON CONFLICT DO NOTHING) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2022-01-10', 20)`, [lea])
  await db.query(`INSERT INTO document.document (id, title) VALUES ('internal-rules', 'Règlement intérieur'), ('rate-card', 'Rate card')`)
  await db.query(`INSERT INTO document.adoption (receipt, document, version, base, adopted) VALUES (1, 'internal-rules', 'internal-rules@2', NULL, '2025-06-20')`)
  await db.query(`INSERT INTO document_membership.reading (version, member, read) VALUES ('internal-rules@2', $1, '2025-06-21')`, [lea])
})

after(async () => {
  await db.end()
})

test('each member is to read every binding version, and Léa has read the internal rules', async () => {
  const rows = await all<{ member: string; version: string; read: string | null }>(
    `SELECT member, version, to_char(read, 'YYYY-MM-DD') AS read FROM document_membership.texts ORDER BY member`,
  )
  assert.deepEqual(rows, [
    { member: ines, version: 'internal-rules@2', read: null },
    { member: lea, version: 'internal-rules@2', read: '2025-06-21' },
  ])
})

test('a later adoption asks everyone to read the new version', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO document.adoption (receipt, document, version, base, adopted) VALUES (2, 'internal-rules', 'internal-rules@3', 'internal-rules@2', '2026-06-20')`)
    const rows = await all<{ member: string; version: string; read: string | null }>(`SELECT member, version, read FROM document_membership.texts ORDER BY member`)
    assert.deepEqual(rows.map((r) => [r.member, r.version, r.read]), [
      [ines, 'internal-rules@3', null],
      [lea, 'internal-rules@3', null],
    ])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('outside a write the guard judges no reading anyone\'s own', async () => {
  assert.match((await reads({ member: ines, version: 'internal-rules@2' })) ?? '', /no one may mark only their own reading/)
})
