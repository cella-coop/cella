// A hire's first device, on a database holding the app's core, the person
// feat and this one: `employment.carries` checks the hire
// enrolled the device its payload names, under the worker's address, on
// the write's day and by no device, and refuses a hire with none. Run by
// `cella test slice employment`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const olivier = 'olivier@lanterne.example'
const key = 'ab'.repeat(32)

const carries = async (payload: object) => (await db.query<{ r: string | null }>('SELECT employment.carries($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Olivier Roux') ON CONFLICT DO NOTHING)
     INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired)
     VALUES ($1, 'Olivier Roux', 'apprentice developer', 'apprenticeship', '2026-11-02', '2028-08-31', 2100, '2026-10-24')`,
    [olivier],
  )
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, 'laptop', '2026-10-24')`, [key, olivier])
})

after(async () => {
  await db.end()
})

test('a hire carries the device it enrolled, under the worker\'s address, on its day', async () => {
  assert.equal(await carries({ worker: olivier, key }), null)
})

test('a hire with no device, or one it did not enrol, is refused', async () => {
  assert.match((await carries({ worker: olivier })) ?? '', /olivier@lanterne.example is hired with no first device/)
  assert.match((await carries({ worker: olivier, key: 'cd'.repeat(32) })) ?? '', /first device was not enrolled by this hire/)
  assert.match((await carries({ worker: 'ines@lanterne.example', key })) ?? '', /first device was not enrolled by this hire/)
})
