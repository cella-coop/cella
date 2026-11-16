// A demo build, end to end on a seeded Lanterne: the built server outside
// dev mode with `CELLA_DEMO`, as `cella serve --prod --demo` and the NixOS
// module's demo option run it. Its sign-in offers Lanterne's fixture
// members, each marked as a demo member, under the demo's banner, and a
// member signed in with their TEST-ONLY device finds the banner on their
// pages and writes through the notary. The same build without it, a
// scope's server, offers no one and wears no banner.
// covers: core

import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { fixture, random, sha256 } from '@cella/org-sign'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const camille = 'camille@lanterne.example'
const banner = "This is a prototype environment for demo purposes and can't be used for real work."

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await su.end()
})

it('a demo build offers every fixture member at its sign-in, each marked as a demo member, under the demo banner', async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1' })
  const { text } = await shell.page('/sign-in')
  // The members whose device in force is a fixture's, its key derived from
  // their address and its label, as the sign-in offers them.
  const devices = (await su.query<{ address: string; label: string; key: string }>("SELECT address, label, encode(key, 'hex') AS key FROM person.device WHERE revoked IS NULL")).rows
  const derived = await Promise.all(devices.map(async (d) => ((await fixture(d.address, d.label)).key === d.key ? d.address : null)))
  const members = new Set(derived.filter((a) => a !== null)).size
  assert.ok(members > 0, 'Lanterne enrols its members’ fixture devices')
  assert.match(text, /Demo members/)
  assert.equal(text.split('demo member</span>').length - 1, members, 'each member offered is marked as a demo member')
  assert.match(text, /Camille Martin/)
  assert.ok(text.includes(banner), 'the sign-in wears the demo’s banner')
  assert.doesNotMatch(text, /Fixture members/)
})

it('a demo member signs in with their derived key, finds the banner on their pages and writes through the notary', async () => {
  const { text } = await shell.page('/inbox', camille)
  assert.ok(text.includes(banner), 'a signed-in page wears the demo’s banner')
  const done = await shell.act('/people', 'invite', { name: 'Demo Petit', address: 'demo.petit@lanterne.example', link: await sha256(random()) }, camille)
  assert.equal(done.state, 'settled', done.reason)
  assert.ok(shell.signed > 0, 'the member’s device signed it')
})

it('the same build with no demo offers no one and wears no banner', async () => {
  await shell.start('2026-10-24')
  const { text } = await shell.page('/sign-in')
  assert.doesNotMatch(text, /Demo members|Fixture members|demo member/)
  assert.ok(!text.includes(banner), 'a scope’s server wears no demo banner')
})
