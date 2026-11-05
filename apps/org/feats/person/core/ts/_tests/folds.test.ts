// The person feat's folds, on a database holding the app's core and this
// feat (`sql/007-folds.sql`): each entry as the log keeps it, a personal
// value as its commitment, applied by the fold below the notary, as
// `cella fold` applies it; a folded column reads `redacted` and its
// commitment as the source's would. Run by `cella test slice person`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const camille = 'camille@lanterne.example'
const laptop = 'aa'.repeat(32)
const phone = 'bb'.repeat(32)
const commit = (c: string) => ({ $commit: c.repeat(64) })
const fold = async (fn: string, n: number, op: string, payload: unknown, date = '2026-10-24') =>
  db.query(`SELECT person.${fn}($1)`, [{ n, op, actor: camille, date, cause: null, payload }])
const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('an invitation enters a person new to the scope by their name\'s commitment, and an acceptance enrols their first device', async () => {
  await fold('fold_entering', 2, 'membership:member:invite', { member: camille, invited: '2026-10-24', name: commit('1') })
  await fold('fold_enrolling', 3, 'membership:member:accept', { member: camille, key: laptop, label: commit('2'), device: commit('3') }, '2026-10-25')
  assert.deepEqual(await one('SELECT name FROM person.person WHERE address = $1', [camille]), { name: 'redacted' })
  assert.deepEqual(await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled, enrolled_by FROM person.device WHERE key = decode($1, 'hex')`, [laptop]), {
    label: 'redacted',
    enrolled: '2026-10-25',
    enrolled_by: null,
  })
  assert.deepEqual(await one(`SELECT cella.committed('person.person.name', $1, 'redacted') AS c`, [camille]), { c: '1'.repeat(64) })
  assert.deepEqual(await one(`SELECT cella.committed('person.device.label', $1, 'redacted') AS c`, [camille]), { c: '3'.repeat(64) })
})

test('a device enrolled by another is named by it, a profile writes its fields\' commitments, and a revocation holds', async () => {
  await fold('fold_enrol', 4, 'person:device:enrol', { address: camille, key: phone, label: commit('4'), by: laptop, enrolled: '2026-10-26' }, '2026-10-26')
  await fold('fold_enrol', 5, 'person:device:enrol', { address: camille, key: phone, label: commit('5'), by: laptop, enrolled: '' }, '2026-10-26')
  assert.deepEqual(await one(`SELECT encode(enrolled_by, 'hex') AS by FROM person.device WHERE key = decode($1, 'hex')`, [phone]), { by: laptop })
  await fold('fold_profile', 6, 'person:person:profile', { person: camille, fields: ['email', 'phone'], values: { email: commit('6'), phone: null } })
  assert.deepEqual(await one('SELECT name, email, phone FROM person.person WHERE address = $1', [camille]), { name: 'redacted', email: 'redacted', phone: null })
  await fold('fold_revoke', 7, 'person:device:revoke', { key: phone, revoked: '2026-10-27' }, '2026-10-27')
  assert.deepEqual(await one(`SELECT to_char(revoked, 'YYYY-MM-DD') AS revoked FROM person.device WHERE key = decode($1, 'hex')`, [phone]), { revoked: '2026-10-27' })
})

test('a value the log keeps plain refuses to fold, naming its field', async () => {
  await assert.rejects(
    fold('fold_profile', 8, 'person:person:profile', { person: camille, fields: ['phone'], values: { phone: '+33 6 00 00 00 00' } }),
    /entry 8 keeps the person.person.phone of camille@lanterne.example as .*, not as its commitment/,
  )
})
