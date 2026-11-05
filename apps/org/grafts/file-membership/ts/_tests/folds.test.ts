// file-membership's fold (`sql/004-folds.sql`), on a database holding the
// app's core, the file and member feats and this graft, in a transaction
// rolled back after: a member's record folded as the file feat's fold of
// `storing` stores it, its name and bytes as their commitments, then kept
// on the member's file. Run by `cella test slice file-membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(64) })

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Sacha Folded')) INSERT INTO membership.member (address, status, since, shares) VALUES ($1, 'active', '2040-03-01', 1)`, [sacha])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a member\'s record folds stored about them, of class profile, and kept on their file', async () => {
  await db.query(`SELECT file_membership.fold_attach($1)`, [{
    n: 1, op: 'file-membership:member:attach', actor: sacha, date: '2041-02-03', cause: null,
    payload: { file: 'fi-9001', class: 'profile', subject: sacha, type: 'application/pdf', size: 9, hash: commitment('a'), name: commitment('b'), member: sacha },
  }])
  assert.deepEqual((await db.query(`SELECT f.id, f.name, f.bytes, f.uploader, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded, r.member
                                    FROM file.record f JOIN file_membership.record r ON r.file = f.id WHERE f.id = 'fi-9001'`)).rows, [
    { id: 'fi-9001', name: 'redacted', bytes: null, uploader: sacha, uploaded: '2041-02-03', member: sacha },
  ])
  assert.equal((await db.query(`SELECT FROM cella.commitment WHERE subject = $1 AND field LIKE 'file.record.%'`, [sacha])).rowCount, 2)
})
