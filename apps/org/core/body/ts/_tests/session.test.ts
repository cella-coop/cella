// Core body's live session, no database: two peers editing through it
// over a save of the test's own, the saves a pause, the editing going on
// and the last editor leaving make, a peer dropped when its answer turns
// no, a reader who may not discuss, and a restart that replays the
// buffer and saves. The clock is the test's. Run by `cella test slice
// body`.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, appendFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db, Deps } from '@cella/org-db'
import type { LoroDoc } from 'loro-crdt'
import { createDoc } from '../src/models/blocks.ts'
import { create } from '../src/models/edits.ts'
import { canonical } from '../src/models/canonical.ts'
import { Session, type Clock, type Heard, type Save, type Peer } from '../src/api/session.ts'
import { files, memory, type Buffer } from '../src/api/buffer.ts'
import { b64 } from '../src/models/body.ts'
import { open, post } from '../src/api/live.ts'

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setImmediate(r))
  }
}

// A clock the test moves by hand, running each timer due in order.
function manual(): Clock & { tick(ms: number): Promise<void> } {
  let now = 0
  let id = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  return {
    set(fn, ms) {
      timers.set(++id, { at: now + ms, fn })
      return id
    },
    clear(t) {
      timers.delete(t as number)
    },
    async tick(ms) {
      const until = now + ms
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) {
          break
        }
        timers.delete(due[0])
        now = due[1].at
        due[1].fn()
        await settle()
      }
      now = until
    },
  }
}

// The test's own feat: tasks t-1 and t-2 in circle web, read by everyone
// it names, a power in a circle held as `actor@circle` says, and a save
// that keeps what it was handed.
function world(buffer: Buffer = memory()) {
  let lost = false
  const readers = new Set(['ana', 'ben', 'cleo'])
  const holds = new Set(['ana@web', 'ben@web'])
  const saved = new Map<string, Uint8Array>()
  const saves: Save[] = []
  let refuse: string | null = null
  const db = {} as Db
  const clock = manual()
  const session = new Session({
    using: (actor, fn) => (lost ? Promise.reject(new Error('the connection was lost')) : actor === null || readers.has(actor) ? fn(db) : fn({ none: true } as unknown as Db)),
    may: async (_db, actor, power, circle) => power === 'discuss' && holds.has(`${actor}@${circle}`),
    scope: () => ({ actor: 'scope' }) as Deps,
    buffer,
    clock,
  })
  session.mount({
    kind: 'tasks',
    circle: async (d, record) => ((d as unknown as { none?: boolean }).none || !['t-1', 't-2'].includes(record) ? null : 'web'),
    saved: async (_d, record) => saved.get(record) ?? null,
    save: async (input, deps) => {
      assert.equal(deps.actor, 'scope')
      if (refuse) {
        return { state: 'refused', verdict: 1, reason: refuse }
      }
      saves.push(input)
      saved.set(input.record, input.snapshot)
      return { state: 'settled', entry: saves.length, value: null }
    },
  })
  return { session, clock, readers, holds, saved, saves, buffer, refuse: (r: string | null) => (refuse = r), lose: (l: boolean) => (lost = l) }
}

// An editor's own document, kept in step with what its peer hears.
async function editor(session: Session, actor: string, record = 't-1') {
  const joined = await session.join('tasks', record, actor)
  assert.ok(joined, `${actor} joins ${record}`)
  const doc: LoroDoc = createDoc()
  doc.import(joined.update)
  const heard: Heard[] = []
  joined.peer.listen((h) => {
    heard.push(h)
    if (h.type === 'update') {
      doc.import(h.update)
    }
  })
  return {
    doc,
    heard,
    peer: joined.peer as Peer,
    // One edit, as one commit, posted as the update it made.
    async type(text: string, at = 0) {
      const before = doc.oplogVersion()
      create(doc, undefined, at, 'paragraph', {}, [{ text }])
      doc.commit()
      return session.post('tasks', record, actor, doc.export({ mode: 'update', from: before }))
    },
  }
}

const words = (doc: LoroDoc) => canonical(doc).blocks.map((b) => b.runs?.map((r) => r.text).join('') ?? '')

describe('two peers', () => {
  it('merge through the session, which relays each update to both', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    assert.deepEqual(await ana.type('alpha'), { state: 'merged' })
    assert.deepEqual(await ben.type('beta', 1), { state: 'merged' })
    assert.deepEqual(words(ana.doc), ['alpha', 'beta'])
    assert.deepEqual(canonical(ben.doc), canonical(ana.doc))
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ana', 'ben'])
  })

  it('converge on concurrent edits, and a late joiner catches up by its version vector', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    const a = ana.doc.oplogVersion()
    create(ana.doc, undefined, 0, 'paragraph', {}, [{ text: 'from ana' }])
    ana.doc.commit()
    const b = ben.doc.oplogVersion()
    create(ben.doc, undefined, 0, 'paragraph', {}, [{ text: 'from ben' }])
    ben.doc.commit()
    await w.session.post('tasks', 't-1', 'ben', ben.doc.export({ mode: 'update', from: b }))
    await w.session.post('tasks', 't-1', 'ana', ana.doc.export({ mode: 'update', from: a }))
    assert.deepEqual(canonical(ana.doc), canonical(ben.doc))
    assert.equal(canonical(ana.doc).blocks.length, 2)
    const late = await w.session.join('tasks', 't-1', 'ben', b64.encode(ben.doc.oplogVersion().encode()))
    assert.ok(late)
    const cleo = await editor(w.session, 'cleo')
    assert.deepEqual(canonical(cleo.doc), canonical(ana.doc))
  })

  it('refuses bytes that are not a Loro update, merging nothing', async () => {
    const w = world()
    await editor(w.session, 'ana')
    const out = await w.session.post('tasks', 't-1', 'ana', new Uint8Array([1, 2, 3]))
    assert.equal(out.state, 'refused')
    await w.clock.tick(60_000)
    assert.equal(w.saves.length, 0)
  })

  it('refuses a post from one who has not opened the body', async () => {
    const w = world()
    await editor(w.session, 'ana')
    const out = await w.session.post('tasks', 't-1', 'ben', new Uint8Array())
    assert.equal(out.state, 'refused')
  })
})

describe('saves', () => {
  it('save after a pause of 3 seconds, carrying the snapshot and who contributed', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    await ana.type('alpha')
    await w.clock.tick(2_000)
    await ben.type('beta', 1)
    await w.clock.tick(2_999)
    assert.equal(w.saves.length, 0)
    await w.clock.tick(1)
    assert.equal(w.saves.length, 1)
    assert.equal(w.saves[0].record, 't-1')
    assert.deepEqual(w.saves[0].contributors, ['ana', 'ben'])
    const kept = createDoc()
    kept.import(w.saves[0].snapshot)
    assert.deepEqual(canonical(kept), canonical(ana.doc))
  })

  it('save every 30 seconds while editing goes on, and name only who edited since the last', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    await ben.type('first')
    for (let s = 1; s <= 29; s++) {
      await w.clock.tick(1_000)
      await ana.type(`a${s}`)
    }
    assert.equal(w.saves.length, 0)
    await w.clock.tick(1_000)
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.saves[0].contributors, ['ana', 'ben'])
    await ana.type('after')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 2)
    assert.deepEqual(w.saves[1].contributors, ['ana'])
  })

  it('save when the last editor leaves, and make none with nothing new', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    await ana.type('alpha')
    await ben.peer.leave()
    assert.equal(w.saves.length, 0)
    await ana.peer.leave()
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.session.editors('tasks', 't-1'), [])
    const again = await editor(w.session, 'ben')
    assert.deepEqual(words(again.doc), ['alpha'])
    await again.peer.leave()
    await w.clock.tick(60_000)
    assert.equal(w.saves.length, 1)
  })

  it('keep a refused save’s updates for the next, and say why', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    await ana.type('alpha')
    w.refuse('the task is archived')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 0)
    assert.equal(w.session.problem('tasks', 't-1'), 'the task is archived')
    w.refuse(null)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.equal(w.session.problem('tasks', 't-1'), null)
  })
})

describe('a save that throws', () => {
  it('says why and keeps its updates for the next, failing nothing', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    await ana.type('alpha')
    w.lose(true)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 0)
    assert.equal(w.session.problem('tasks', 't-1'), 'the connection was lost')
    w.lose(false)
    await ana.type('beta', 1)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.session.problem('tasks', 't-1'), null)
  })
})

describe('the answer, asked again', () => {
  it('drops a peer at its next update once its mandate is revoked, refusing that update', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    await ana.type('kept')
    w.holds.delete('ana@web')
    const out = await ana.type('refused')
    assert.equal(out.state, 'refused')
    assert.match((out as { reason: string }).reason, /discuss in web/)
    assert.deepEqual(ana.heard.at(-1)?.type, 'dropped')
    assert.deepEqual(words(ben.doc), ['kept'])
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ben'])
    await ben.type('on', 1)
    await w.clock.tick(3_000)
    assert.deepEqual(w.saves[0].contributors, ['ana', 'ben'])
  })

  it('drops a writable peer at a save once it may no longer discuss, and one that no longer reads', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    const ben = await editor(w.session, 'ben')
    const cleo = await editor(w.session, 'cleo')
    await ana.type('alpha')
    w.holds.delete('ben@web')
    w.readers.delete('cleo')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.equal(ben.heard.at(-1)?.type, 'dropped')
    assert.equal(cleo.heard.at(-1)?.type, 'dropped')
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ana'])
  })

  it('opens the body read-only to one who reads it and may not discuss it, and refuses their edit', async () => {
    const w = world()
    const cleo = await editor(w.session, 'cleo')
    assert.equal(cleo.peer.writable, false)
    assert.equal((await cleo.type('no')).state, 'refused')
  })

  it('opens nothing to one who reads no such record', async () => {
    const w = world()
    w.readers.delete('ana')
    assert.equal(await w.session.join('tasks', 't-1', 'ana'), null)
    assert.equal(await w.session.join('tasks', 't-9', 'ben'), null)
  })
})

describe('a restart', () => {
  it('replays the buffer into the next session and saves at once', async () => {
    const buffer = memory()
    const first = world(buffer)
    const ana = await editor(first.session, 'ana')
    const ben = await editor(first.session, 'ben', 't-2')
    await ana.type('alpha')
    await ben.type('beta')
    await ana.type('gamma', 1)
    assert.equal(first.saves.length, 0)
    // The server stops here; the next one starts on the same buffer.
    const next = world(buffer)
    assert.equal(await next.session.recover(), 2)
    const t1 = next.saves.find((s) => s.record === 't-1')
    assert.ok(t1)
    assert.deepEqual(t1.contributors, ['ana'])
    const kept = createDoc()
    kept.import(t1.snapshot)
    assert.deepEqual(words(kept), ['alpha', 'gamma'])
    assert.deepEqual(buffer.held(), [])
    assert.equal(await next.session.recover(), 0)
  })

  it('keeps the buffer on file, leaving out a line a crash cut short, and clears it at a save', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cella-body-'))
    const first = world(files(dir))
    const ana = await editor(first.session, 'ana')
    await ana.type('alpha')
    await ana.type('beta', 1)
    const [name] = readdirSync(dir)
    assert.equal(decodeURIComponent(name), 'tasks/t-1')
    appendFileSync(join(dir, name), 'ana\tAAAA')
    const next = world(files(dir))
    assert.equal(await next.session.recover(), 1)
    const kept = createDoc()
    kept.import(next.saves[0].snapshot)
    assert.deepEqual(words(kept), ['alpha', 'beta'])
    assert.deepEqual(readdirSync(dir), [])
  })

  it('carries a buffered body whose recovery was refused into the next to open it', async () => {
    const buffer = memory()
    const first = world(buffer)
    const ana = await editor(first.session, 'ana')
    await ana.type('alpha')
    const next = world(buffer)
    next.refuse('not now')
    assert.equal(await next.session.recover(), 0)
    next.refuse(null)
    const ben = await editor(next.session, 'ben')
    assert.deepEqual(words(ben.doc), ['alpha'])
    await ben.peer.leave()
    assert.equal(next.saves.length, 1)
    assert.deepEqual(next.saves[0].contributors, ['ana'])
  })
})

describe('the live route', () => {
  it('streams joined and the catch-up, takes a posted update, and answers as a form', async () => {
    const w = world()
    const ana = await editor(w.session, 'ana')
    await ana.type('alpha')
    const abort = new AbortController()
    const res = await open(w.session, { kind: 'tasks', record: 't-1', actor: 'ben', request: new Request('http://x/tasks/t-1/body/live', { signal: abort.signal }) })
    assert.equal(res.status, 200)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (!text.includes('event: update')) {
      text += decoder.decode((await reader.read()).value)
    }
    assert.match(text, /event: joined\ndata: \{"writable":true\}/)
    const form = new FormData()
    const before = ana.doc.oplogVersion()
    create(ana.doc, undefined, 1, 'paragraph', {}, [{ text: 'beta' }])
    ana.doc.commit()
    form.set('update', b64.encode(ana.doc.export({ mode: 'update', from: before })))
    const ok = await post(w.session, { kind: 'tasks', record: 't-1', actor: 'ben', request: new Request('http://x', { method: 'POST', body: form }) })
    assert.deepEqual(await ok.json(), { type: 'success', status: 200 })
    const no = await post(w.session, { kind: 'tasks', record: 't-1', actor: 'cleo', request: new Request('http://x', { method: 'POST', body: form }) })
    assert.equal(((await no.json()) as { type: string }).type, 'failure')
    abort.abort()
    await settle()
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ana'])
    const none = await open(w.session, { kind: 'tasks', record: 't-9', actor: 'ben', request: new Request('http://x') })
    assert.equal(none.status, 404)
  })
})
