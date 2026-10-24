// An invitation's first device, on a database holding the app's core, the
// key and member feats and this graft: the admission enrols the device
// the invitation carried, in its own transaction, and an admission with
// none is refused; `key_member.carries` checks an invitation carries the
// key its payload names. Run by `cella test slice key-member`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const ines = 'ines@lanterne.example'
const key = 'ab'.repeat(32)

const carries = async (payload: object) => (await db.query<{ r: string | null }>('SELECT key_member.carries($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO member.member (address, name, status, shares) VALUES ($1, 'Inès Haddad', 'invited', 0), ('nadia@lanterne.example', 'Nadia', 'invited', 0)`,
    [ines],
  )
  await db.query(`INSERT INTO key_member.invitation (member, key, label) VALUES ($1, decode($2, 'hex'), 'laptop')`, [ines, key])
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
    db.query(`UPDATE member.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = 'nadia@lanterne.example'`),
    (e: Error & { code?: string }) => e.code === '09000' && /has no first device: an invitation carries one/.test(e.message),
  )
  await db.query('ROLLBACK')
})

test('the admission enrols the device the invitation carried, by no device, on its day', async () => {
  await db.query(`UPDATE member.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  const { rows } = await db.query(`SELECT encode(key, 'hex') AS key, address, label, enrolled_by FROM key.device`)
  assert.deepEqual(rows, [{ key, address: ines, label: 'laptop', enrolled_by: null }])
  assert.match((await carries({ member: ines, key })) ?? '', /is enrolled already/)
})
