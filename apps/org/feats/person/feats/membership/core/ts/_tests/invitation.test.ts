// An invitation and its link, on a database holding the app's core, the
// person feat and this one: the invitation carries the digest of a link's
// secret; taking it up, signed by the device it enrols, makes that device
// the invitee's first, once; an admission is refused to someone who holds
// no device. Run by `cella test slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, random, sha256, signer } from '@cella/org-sign'
import { accept, invite, link } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@test.example'
const ines = 'ines@test.example'
const nadia = 'nadia@test.example'

const as = (actor: string, label = 'laptop'): Deps => ({ db, actor, sign: signer(scope, actor, fixture(actor, label)) })
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', out.reason)
  return out.value as T
}
const refusal = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const carries = async (payload: object) => (await db.query<{ r: string | null }>('SELECT membership.carries($1) AS r', [payload])).rows[0].r
const devices = async (address: string) =>
  (await db.query(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled, enrolled_by FROM person.device WHERE address = $1`, [address])).rows

const secret = random()

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  // Camille invites, from the laptop her hire enrolled.
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Camille Martin')`, [camille])
  await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, 'laptop', '2025-01-01')`, [(await fixture(camille, 'laptop')).key, camille])
})

after(async () => {
  await db.end()
})

test('an invitation carries the digest of its link, which only the link\'s secret opens', async () => {
  const digest = await sha256(secret)
  assert.deepEqual(settled(await invite({ address: ines, name: 'Inès Haddad', link: digest }, as(camille))), { member: ines, invited: '2026-10-24', link: digest })
  assert.equal(await carries({ member: ines, link: digest }), null)
  assert.match((await carries({ member: ines, link: 'cd'.repeat(32) })) ?? '', /carries no link its payload names/)
  assert.ok(!(await db.query(`SELECT FROM membership.link WHERE digest = decode($1, 'hex')`, [secret])).rowCount, 'the server keeps the digest, never the secret')
  settled(await invite({ address: nadia, name: 'Nadia Ferhat' }, as(camille)))
})

test('taking it up is signed by the device it enrols, and enrols it as the invitee\'s first, once', async () => {
  const laptop = await fixture(ines, 'laptop')
  await assert.rejects(accept({ member: ines, secret: random(), key: laptop.key, label: 'laptop' }, as(ines)), /this link is not an invitation of ines/)
  await assert.rejects(accept({ member: nadia, secret, key: laptop.key, label: 'laptop' }, as(nadia)), /this link is not an invitation of nadia/)
  const phone = await fixture(ines, 'phone')
  const forged = await accept({ member: ines, secret, key: phone.key, label: 'phone' }, as(ines))
  assert.match(refusal(forged), /current key|device/, 'a key the acceptance does not enrol signs nothing')
  assert.deepEqual(await devices(ines), [])

  const accepted = settled(await accept({ member: ines, secret, key: laptop.key, label: 'laptop' }, as(ines)))
  assert.deepEqual(accepted, { member: ines, link: await sha256(secret), key: laptop.key, accepted: '2026-10-24' })
  assert.deepEqual(await devices(ines), [{ label: 'laptop', enrolled: '2026-10-24', enrolled_by: null }])
  await assert.rejects(accept({ member: ines, secret, key: laptop.key, label: 'laptop' }, as(ines)), /has taken up their invitation already/)
  assert.match(refusal(await link({ member: ines, link: await sha256(random()) }, as(camille))), /has taken up their invitation/)
})

test('a new link is for someone invited who has not taken it up', async () => {
  const fresh = await sha256(random())
  assert.deepEqual(settled(await link({ member: nadia, link: fresh }, as(camille))), { member: nadia, link: fresh })
  await assert.rejects(link({ member: camille, link: await sha256(random()) }, as(camille)), /no one invited is camille/)
})

test('an admission is refused to someone who holds no device, and nothing it wrote stays', async () => {
  await db.query('BEGIN')
  await assert.rejects(
    db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 10 WHERE address = $1`, [nadia]),
    (e: Error & { code?: string }) => e.code === '09000' && /holds no device to sign with: they take up their invitation first/.test(e.message),
  )
  await db.query('ROLLBACK')
})

test('an admission of someone who took up their invitation enrols nothing more', async () => {
  await db.query(`UPDATE membership.member SET status = 'active', since = '2026-10-31', shares = 20 WHERE address = $1`, [ines])
  assert.deepEqual(await devices(ines), [{ label: 'laptop', enrolled: '2026-10-24', enrolled_by: null }])
})

test('the log verifies', async () => {
  assert.equal((await db.query<{ v: boolean }>('SELECT cella.verify_log() AS v')).rows[0].v, true)
})
