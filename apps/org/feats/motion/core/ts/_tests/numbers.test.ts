// A motion's id by its number, on a database holding the app's core and
// this feat, in a transaction rolled back after: the year's next takes as
// many digits as it needs, so the 1,000th of a year follows the 999th and
// collides with no other. Run by `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { proposing } from '@cella/org-motion/api'

const db = new pg.Client()
const camille = 'camille@lanterne.example'

before(async () => {
  await db.connect()
  // Nothing here outlasts the file: the slice's other tests read the same database.
  await db.query('BEGIN')
  await db.query(`SET LOCAL cella.clock = '2031-11-07'`)
  await db.query(`SELECT set_config('cella.actor', $1, true)`, [camille])
  await db.query(`INSERT INTO circle.circle (id, name) SELECT 'ag', 'ag' WHERE NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = 'ag')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

const propose = async (title: string) =>
  (await proposing({ circle: 'ag', title, deadline: '2031-11-21', body: title, actions: [] }).state(db, {} as never)).motion

test('a motion is the year\'s next, three digits or more: m-2031-1000 follows m-2031-999', async () => {
  await db.query(
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, ballot, proposed, deadline)
     SELECT 'm-2031-' || lpad(i::text, 3, '0'), 'ag', $1, 'x', 'consent', 'consent', 'open', '2031-11-07', '2031-11-21' FROM generate_series(1, 998) i`,
    [camille],
  )
  assert.equal(await propose('the 999th'), 'm-2031-999')
  assert.equal(await propose('the 1,000th'), 'm-2031-1000')
  assert.equal(await propose('the 1,001st'), 'm-2031-1001')
})
