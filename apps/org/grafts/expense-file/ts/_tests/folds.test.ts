// The expense-file graft's folds (`sql/002-folds.sql`), on a database
// holding the app's core, the expense and file feats and this graft, in a
// transaction rolled back after: a claim carrying its receipt folds the
// file its entry stored, by the file feat's fold of `storing`, its name
// and bytes as erasure leaves them, and attaches it; a claim without one
// attaches nothing; a receipt attached later folds the same. Run by
// `cella test slice expense-file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sofia = 'sofia@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(32) })

const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT expense_file.${fn}($1)`, [{ n, op, actor: sofia, date: '2041-02-03', cause: null, payload }])
const receipt = (file: string) => ({ file, class: 'expense-receipt', subject: sofia, type: 'application/pdf', size: 12, hash: commitment('ab'), name: commitment('cd') })

before(async () => {
  await db.connect()
  await db.query('BEGIN')
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a claim folds its receipt stored about its actor and attached; one without one attaches nothing; one attached later folds the same', async () => {
  await fold('fold_capture', 1, 'expense:expense:capture', { expense: 'ex-9901', member: sofia, label: commitment('ef'), ...receipt('fi-9901') })
  await fold('fold_capture', 2, 'expense:expense:capture', { expense: 'ex-9902', member: sofia, label: commitment('ef'), receipt: null })
  await fold('fold_attach', 3, 'expense-file:expense:attach', { expense: 'ex-9902', ...receipt('fi-9902') })
  assert.deepEqual((await db.query(`SELECT r.expense, f.id, f.class, f.subject, f.name, f.bytes, f.size, f.uploader, to_char(f.uploaded, 'YYYY-MM-DD') AS uploaded
    FROM expense_file.receipt r JOIN file.file f ON f.id = r.file WHERE r.expense IN ('ex-9901', 'ex-9902') ORDER BY r.expense`)).rows, [
    { expense: 'ex-9901', id: 'fi-9901', class: 'expense-receipt', subject: sofia, name: 'redacted', bytes: null, size: 12, uploader: sofia, uploaded: '2041-02-03' },
    { expense: 'ex-9902', id: 'fi-9902', class: 'expense-receipt', subject: sofia, name: 'redacted', bytes: null, size: 12, uploader: sofia, uploaded: '2041-02-03' },
  ])
  assert.deepEqual((await db.query(`SELECT field, count(*)::int AS n FROM cella.commitment WHERE subject = $1 AND field LIKE 'file.receipt.%' GROUP BY field ORDER BY field`, [sofia])).rows, [
    { field: 'file.receipt.bytes', n: 2 },
    { field: 'file.receipt.name', n: 2 },
  ])
})
