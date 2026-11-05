// The relay's caps, end to end on a seeded Lanterne through the built
// shell, each run a member renaming themselves on their page: Camille
// starts three writes and signs none; her fourth fails before it starts,
// while Malik's first runs and settles; once her three give up, which
// takes two seconds here (`CELLA_PATIENCE`), her next starts. With the
// server's cap at two (`CELLA_PENDING`), Hugo's write fails while
// Camille's and Malik's wait, and starts once theirs give up. Run by
// `cella test e2e pending`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'
const malik = 'malik@lanterne.example'
const hugo = 'hugo@lanterne.example'

// How long a run waits for each signature here, in seconds.
const patience = 2

const ended = () => new Promise((r) => setTimeout(r, patience * 1000 + 500))

// One post starting `actor`'s rename, its signature left unanswered.
async function start(actor: string, cookie: string, name: string) {
  return shell.post(`/people/${encodeURIComponent(actor)}`, 'profile', new URLSearchParams({ name }), cookie)
}

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('A person has three writes pending; a fourth fails while another person’s first settles, and a place frees as a run gives up', async () => {
  await shell.start('2026-10-24', { CELLA_PATIENCE: String(patience) })
  const cookie = await shell.signIn(camille)
  for (const n of [1, 2, 3]) {
    const pending = await start(camille, cookie, `Camille ${n}`)
    assert.ok(pending.sign, `Camille's write ${n} asks for her signature: ${JSON.stringify(pending)}`)
  }
  const fourth = await start(camille, cookie, 'Camille 4')
  assert.equal(fourth.status, 429)
  assert.deepEqual([fourth.sign, fourth.done?.state], [undefined, 'failed'])
  assert.match(fourth.done?.reason ?? '', /you have 3 writes waiting on your signature/)
  const elsewhere = await shell.signIn(camille)
  assert.equal((await start(camille, elsewhere, 'Camille 5')).status, 429, 'her other sessions count with her first')

  const maliks = await shell.act(`/people/${encodeURIComponent(malik)}`, 'profile', { name: 'Malik B.' }, malik)
  assert.equal(maliks.state, 'settled', maliks.reason)

  await ended()
  const again = await start(camille, cookie, 'Camille 6')
  assert.ok(again.sign, `a place freed as her runs gave up: ${JSON.stringify(again)}`)
})

test('The server has a cap on everyone’s pending writes, and a place frees as a run gives up', async () => {
  await shell.start('2026-10-24', { CELLA_PATIENCE: String(patience), CELLA_PENDING: '2' })
  assert.ok((await start(camille, await shell.signIn(camille), 'Camille')).sign)
  assert.ok((await start(malik, await shell.signIn(malik), 'Malik')).sign)
  const cookie = await shell.signIn(hugo)
  const hugos = await start(hugo, cookie, 'Hugo')
  assert.equal(hugos.status, 429)
  assert.match(hugos.done?.reason ?? '', /the server has as many writes waiting on a signature as it takes/)

  await ended()
  assert.ok((await start(hugo, cookie, 'Hugo')).sign, 'a place freed as theirs gave up')
})
