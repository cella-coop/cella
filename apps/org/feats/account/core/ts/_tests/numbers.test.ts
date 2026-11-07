// A holder's capital account by its number, on a database holding the
// app's core and this feat, in a transaction rolled back after: the next
// code under its parent takes as many digits as it needs, so the 100th
// holder's follows the 99th's and collides with no other. Run by `cella
// test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { holding } from '@cella/org-account/api'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO account.account (code, label, kind) VALUES ('1098', 'Capital, numbered', 'equity')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a holder\'s account is the next under its parent, two digits or more: 1098100 follows 109899', async () => {
  assert.equal(await holding(db, { parent: '1098', label: 'Capital, the 1st', holder: 'm1@numbers.example' }), '109801')
  await db.query(
    `INSERT INTO account.account (code, label, kind, parent, holder)
     SELECT '1098' || lpad(i::text, 2, '0'), 'Capital', 'equity', '1098', 'm' || i || '@numbers.example' FROM generate_series(2, 99) i`,
  )
  assert.equal(await holding(db, { parent: '1098', label: 'Capital, the 100th', holder: 'm100@numbers.example' }), '1098100')
  assert.equal(await holding(db, { parent: '1098', label: 'Capital, the 101st', holder: 'm101@numbers.example' }), '1098101')
})
