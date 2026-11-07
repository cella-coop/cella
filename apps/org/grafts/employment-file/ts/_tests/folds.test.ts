// employment-file's fold (`sql/002-folds.sql`), on a database holding the
// app's core, the file and worker feats and this graft, in a transaction
// rolled back after: a worker's record folded as the file feat's fold of
// `storing` stores it, its name and bytes as their commitments, then kept
// on the worker's file. Run by `cella test slice employment-file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const camille = 'camille@folded.example'
const sacha = 'sacha@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(64) })

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Sacha Folded')) INSERT INTO employment.worker (address, name, job, contract, start, minutes, hired) VALUES ($1, 'Sacha Folded', 'developer', 'permanent', '2041-01-01', 2100, '2041-01-01')`,
    [sacha],
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a worker\'s record folds stored about them, of class payroll, and kept on their file', async () => {
  await db.query(`SELECT employment_file.fold_attach($1)`, [{
    n: 1, op: 'employment-file:worker:attach', actor: camille, date: '2041-02-03', cause: null,
    payload: { file: 'fi-9001', class: 'payroll', subject: sacha, type: 'application/pdf', size: 7, hash: commitment('a'), name: commitment('b'), worker: sacha },
  }])
  assert.deepEqual((await db.query(`SELECT f.id, f.name, f.bytes, f.uploader, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded, r.worker
                                    FROM file.contract f JOIN employment_file.record r ON r.file = f.id WHERE f.id = 'fi-9001'`)).rows, [
    { id: 'fi-9001', name: 'redacted', bytes: null, uploader: camille, uploaded: '2041-02-03', worker: sacha },
  ])
  assert.equal((await db.query(`SELECT FROM cella.commitment WHERE subject = $1 AND field LIKE 'file.contract.%'`, [sacha])).rowCount, 2)
})
