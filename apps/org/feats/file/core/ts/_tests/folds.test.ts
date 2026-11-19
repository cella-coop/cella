// The file feat's folds (`sql/004-folds.sql`), on a database holding the
// app's core and this feat, in a transaction rolled back after: a file of
// the coop's own folded with its name and the bytes its entry keeps in
// base64, which must hash to the BLAKE3 it names, uploaded by the entry's
// actor on its day; and a personal file, as the write a graft's fold
// calls folds it, its name and bytes as their commitments. Run by `cella
// test slice file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(64) })
// BLAKE3's reference vector for `abc`.
const abc = '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85'

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (n: number, payload: unknown) =>
  db.query(`SELECT file.fold_upload($1)`, [{ n, op: 'file:file:upload', actor: sacha, date: '2041-02-03', cause: null, payload }])

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a file of the coop\'s own folds with its name and bytes, uploaded by the entry\'s actor on its day, and refuses bytes that hash to another', async () => {
  const stored = { file: 'fi-9001', class: 'none', subject: null, type: 'text/plain', size: 3, hash: abc, name: 'statutes.txt', bytes: 'YWJj' }
  await fold(1, stored)
  assert.deepEqual(
    await one(`SELECT class, subject, name, type, size, encode(bytes, 'escape') AS bytes, encode(hash, 'hex') AS hash, uploader, to_char(uploaded, 'YYYY-MM-DD') AS uploaded
               FROM file.file WHERE id = 'fi-9001'`),
    { class: 'none', subject: null, name: 'statutes.txt', type: 'text/plain', size: 3, bytes: 'abc', hash: abc, uploader: sacha, uploaded: '2041-02-03' },
  )
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold(2, { ...stored, file: 'fi-9002', bytes: 'YWJk' }), /entry 2 stores fi-9002 hashing to 6437b3ac.*, but its bytes hash to /)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})

test('a personal file folds in its class\'s part, its name redacted and its bytes null, both as their commitments', async () => {
  await db.query(`SELECT file.fold_storing(3, $1, '2041-02-03', $2)`, [
    sacha,
    { file: 'fi-9003', class: 'profile', subject: sacha, type: 'application/pdf', size: 3, hash: commitment('a'), name: commitment('b'), member: sacha },
  ])
  assert.deepEqual(await one(`SELECT name, size, bytes, hash, subject FROM file.record WHERE id = 'fi-9003'`), { name: 'redacted', size: 3, bytes: null, hash: null, subject: sacha })
  assert.deepEqual((await db.query(`SELECT field FROM cella.commitment WHERE subject = $1 AND n = 3 ORDER BY field`, [sacha])).rows, [
    { field: 'file.record.bytes' },
    { field: 'file.record.name' },
  ])
})
