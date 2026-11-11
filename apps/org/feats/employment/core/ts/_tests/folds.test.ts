// The employment feat's fold of a hire (`sql/006-folds.sql`), on a
// database holding the app's core and this feat: the worker as the entry
// carries them, their name as its commitment, hired on its day. Run by
// `cella test slice employment`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('a hire folds the worker and their contract, their name as its commitment, hired on the entry\'s day', async () => {
  const payload = { worker: sacha, job: 'designer', contract: 'permanent', start: '2026-11-02', until: null, minutes: 2100, hired: '2026-10-28', key: 'ab'.repeat(32), name: { $commit: 'f'.repeat(64) } }
  await db.query('SELECT employment.fold_hire($1)', [{ n: 9, op: 'employment:worker:hire', actor: sacha, date: '2026-10-28', cause: null, payload }])
  assert.deepEqual(
    (await db.query(`SELECT name, job, contract, to_char(start, 'YYYY-MM-DD') AS start, until, minutes, to_char(hired, 'YYYY-MM-DD') AS hired FROM employment.worker WHERE address = $1`, [sacha])).rows[0],
    { name: 'redacted', job: 'designer', contract: 'permanent', start: '2026-11-02', until: null, minutes: 2100, hired: '2026-10-28' },
  )
})
