// Two of the shell's eight connections are kept for reading sessions, end
// to end on a seeded Lanterne through the built shell: while seven
// people's renames, each signed and waiting on a lock on its person's row,
// hold all six of the others and wait for one more, Hugo signs in, a
// proof posted for a run that is over is answered at once, and Camille's
// proof reaches her run before it gives up, which takes three seconds
// here (`CELLA_PATIENCE`), so her write settles once the rows let go. Run
// by `cella test e2e reserve`.
// covers: core

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { signer } from '@cella/org-sign'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
// Holds the rows the renames wait on, in a transaction of its own, so
// `su` reads the server's connections afresh each time.
const holder = new pg.Client()

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const seven = ['malik', 'ines', 'thomas', 'julien', 'yusuf', 'lea', 'chloe'].map((n) => `${n}@lanterne.example`)

// How long a run waits for each signature here, in seconds.
const patience = 3

const page = (actor: string) => `/people/${encodeURIComponent(actor)}`

// Settles, or fails the test when it is still waiting after `ms`.
async function within<T>(p: Promise<T>, what: string, ms = 2000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`${what} waited past ${ms} ms`)), ms)))
  try {
    return await Promise.race([p, late])
  } finally {
    clearTimeout(timer)
  }
}

// The shell's connections waiting on a lock now.
async function held(): Promise<number> {
  const { rows } = await su.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND usename = 'cella_app' AND wait_event_type = 'Lock'`,
  )
  return rows[0].n
}

before(async () => {
  await su.connect()
  await holder.connect()
})

after(async () => {
  await holder.query('ROLLBACK').catch(() => {})
  await shell.stop()
  await su.end()
  await holder.end()
})

test('With every other connection held, a person signs in and a proof reaches its run', async () => {
  await shell.start('2026-10-24', { CELLA_PATIENCE: String(patience) })
  const cookie = await shell.signIn(camille)
  const device = await shell.device(camille)
  const started = await shell.post(page(camille), 'profile', new URLSearchParams({ name: 'Camille R.' }), cookie)
  const ask = started.sign
  assert.ok(ask, `Camille's write asks for her signature: ${JSON.stringify(started)}`)
  for (const p of seven) {
    await shell.signIn(p)
  }

  // Seven renames, each signed and its transaction waiting on its row:
  // six hold the six connections pages and writes share, and one waits
  // for one of them.
  await holder.query('BEGIN')
  await holder.query('SELECT 1 FROM person.person WHERE address = ANY($1) FOR NO KEY UPDATE', [seven])
  const writes = seven.map((p) => shell.act(page(p), 'profile', { name: `${p.split('@')[0]} R.` }, p))
  for (let i = 0; i < 50 && (await held()) < 6; i++) {
    await new Promise((r) => setTimeout(r, 100))
  }
  await new Promise((r) => setTimeout(r, 300))
  assert.equal(await held(), 6, 'the writes hold the six connections pages and writes share, and no more')

  await within(shell.signIn(hugo), 'Hugo’s sign-in')
  const over = await within(
    shell.post(page(camille), 'profile', new URLSearchParams({ 'cella-run': '00', 'cella-proof': JSON.stringify({ device: '', salt: '', nonce: '', sig: '' }) }), cookie),
    'a proof for a run that is over',
  )
  assert.equal(over.status, 409)
  const proof = await signer(ask.scope, ask.actor, device)(ask.op, ask.request)
  const answer = shell.post(page(camille), 'profile', new URLSearchParams({ 'cella-run': ask.run, 'cella-proof': JSON.stringify(proof) }), cookie)

  // Past her run's patience, the rows let go.
  await new Promise((r) => setTimeout(r, patience * 1000 + 500))
  await holder.query('COMMIT')
  for (const done of await within(Promise.all(writes), 'the seven renames', 5000)) {
    assert.equal(done.state, 'settled', done.reason)
  }
  const done = (await within(answer, 'Camille’s proof')).done
  assert.equal(done?.state, 'settled', `her proof reached her run in time: ${JSON.stringify(done)}`)
})
