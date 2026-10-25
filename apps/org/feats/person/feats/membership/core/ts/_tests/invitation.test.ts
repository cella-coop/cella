// An invitation's first device, on a database holding the app's core, the
// person feat and this one: the admission enrols the device the
// invitation carried, in its own transaction, and an admission with none
// is refused; `membership.carries` checks an invitation carries the key
// its payload names. Run by `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const key = 'ab'.repeat(32)

const carries = async (payload: object) => (await db.query<{ r: string | null }>('SELECT membership.carries($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO membership.member (address, status, shares) VALUES ($1, 'invited', 0), ('nadia@lanterne.example', 'invited', 0)`,
    [ines],
  )
  await db.query(`INSERT INTO membership.invitation (member, key, label) VALUES ($1, decode($2, 'hex'), 'laptop')`, [ines, key])
})

after(async () => {
  await db.end()
})

test('an invitation carries the key its payload names, and one no device holds', async () => {
  assert.equal(await carries({ member: ines, key }), null)
  assert.match((await carries({ member: ines, key: 'cd'.repeat(32) })) ?? '', /carries another key than its payload names/)
  assert.match((await carries({ member: 'nadia@lanterne.example', key })) ?? '', /is invited with no first device/)
})

test('an admission with no first device is refused, and nothing it wrote stays', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = 'nadia@lanterne.example'`),
    (e: Error & { code?: string }) => e.code === '09000' && /has no first device: an invitation carries one/.test(e.message),
  )
  await db.query('ROLLBACK')
})

test('an admission of someone who holds a device already, a worker their hire enrolled, needs none carried', async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), 'nadia@lanterne.example', 'laptop', '2026-09-01')`, ['ef'.repeat(32)])
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = 'nadia@lanterne.example'`)
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM person.device WHERE address = 'nadia@lanterne.example'`)).rows[0].n, 1)
  await db.query('ROLLBACK')
})

test('the admission enrols the device the invitation carried, by no device, on its day', async () => {
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  const { rows } = await db.query(`SELECT encode(key, 'hex') AS key, address, label, enrolled_by FROM person.device`)
  assert.deepEqual(rows, [{ key, address: ines, label: 'laptop', enrolled_by: null }])
  assert.match((await carries({ member: ines, key })) ?? '', /is enrolled already/)
})
