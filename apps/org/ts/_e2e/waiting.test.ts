// A write waiting on its signer holds no connection, end to end on a
// seeded Lanterne, through a pool of one as the shell lends its pool
// (`lent` in `@cella/org-db`): while Yusuf's device has not signed, the
// pool's one connection is free, a read gets through it and Camille's
// write settles on it; and what Yusuf's handler read before he signed
// binds nothing, since the guard reads again inside his transaction and
// refuses a milestone on the project Camille archived meanwhile. Run by
// `cella test e2e waiting`.

import { after, afterEach, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { add, archive } from '@cella/org-project/api'
import { lent, type Borrow, type Deps } from '@cella/org-db'
import type { Signer } from '@cella/org-sign'
import { sign } from './lanterne.ts'

const su = new pg.Client()
const pool = new pg.Pool({ user: 'cella_app', max: 1 })
const yusuf = 'yusuf@lanterne.example'
const camille = 'camille@lanterne.example'

// One connection of the pool, reading as `actor`, as the shell's `using`
// lends one.
const using =
  (actor: string): Borrow =>
  async (fn) => {
    const client = await pool.connect()
    try {
      await client.query(`SELECT set_config('cella.actor', $1, false)`, [actor])
      return await fn(client)
    } finally {
      await client.query(`SELECT set_config('cella.actor', '', false)`)
      client.release()
    }
  }

const as = (actor: string, signs: Signer = sign(actor)): Deps => ({ ...lent(using(actor)), actor, sign: signs })

// The pool's connections lent out now.
const out = () => pool.totalCount - pool.idleCount

// Every waiting signer, each let go when its test ends, so a write a
// failed assertion left waiting gives its connection back.
const signers: { go: () => void }[] = []

// A signer that signs only when let go: `ask` resolves when the write asks
// for its signature, and `go` lets the device sign it.
function waiting(actor: string) {
  let asked!: () => void
  let go!: () => void
  const ask = new Promise<void>((resolve) => (asked = resolve))
  const freed = new Promise<void>((resolve) => (go = resolve))
  const signs: Signer = async (op, request) => {
    asked()
    await freed
    return sign(actor)(op, request)
  }
  signers.push({ go })
  return { signs, ask, go }
}

// Settles, or fails the test when the pool stays held.
async function within<T>(p: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const held = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`${what}: the pool stayed held`)), 5000)))
  try {
    return await Promise.race([p, held])
  } finally {
    clearTimeout(timer)
  }
}

before(async () => {
  await su.connect()
})

afterEach(() => {
  for (const s of signers.splice(0)) {
    s.go()
  }
})

after(async () => {
  await pool.end()
  await su.end()
})

test('a write waiting on its signature holds no connection, so a read and another write get through a pool of one', async () => {
  const signer = waiting(yusuf)
  const deps = as(yusuf, signer.signs)
  // The handler's read before its write, as a reaction's is.
  const writing = (async () => {
    const { rows } = await deps.db.query<{ archived: string | null }>(`SELECT archived FROM project.project WHERE id = 'halles-shop'`)
    assert.equal(rows[0]?.archived, null, 'Yusuf reads halles-shop open')
    return add({ project: 'halles-shop', title: 'Launch review' }, deps)
  })()
  await signer.ask
  assert.equal(out(), 0, 'no connection is lent while the signature waits')
  const read = await within(as(camille).db.query<{ title: string }>(`SELECT title FROM project.project WHERE id = 'halles-shop'`), 'a read')
  assert.equal(read.rows[0]?.title, 'Les Halles Paysannes, online shop', 'Camille reads the project')
  signer.go()
  const added = await within(writing, 'the write')
  assert.equal(added.state, 'settled')
  assert.equal(out(), 0, 'the write gives its connection back')
})

test('a project archived while a milestone waits on its signature refuses the milestone at commit', async () => {
  const signer = waiting(yusuf)
  const adding = add({ project: 'halles-shop', title: 'Handover call' }, as(yusuf, signer.signs))
  await signer.ask
  const archived = await within(archive({ project: 'halles-shop' }, as(camille)), 'the archive')
  assert.equal(archived.state, 'settled')
  signer.go()
  const added = await within(adding, 'the milestone')
  assert.equal(added.state, 'refused')
  assert.match(added.state === 'refused' ? added.reason : '', /halles-shop was archived on/)
  const { rows } = await su.query<{ n: string }>(`SELECT count(*) AS n FROM project.milestone WHERE project = 'halles-shop' AND title = 'Handover call'`)
  assert.equal(rows[0].n, '0', 'the refused milestone left nothing')
  assert.equal(out(), 0)
})
