// Core body's live session, no database, with each editor's browser as
// `Live` drives it: two peers editing through it, the saves a browser's
// pause and its leaving make through a save action of the test's own,
// each signed by the browser's device and naming who contributed, a save
// with nothing new not made, a refused save kept for the next, a peer
// dropped when its answer turns no, a reader who may not discuss, and a
// restart in which a browser rejoins, posts what the session lacks and
// saves it. The clock is the test's. Run by `cella test slice body`.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Db } from '@cella/org-db'
import { digest, generate, message, signer, verify, type Device, type Json, type Proof } from '@cella/org-sign'
import type { LoroDoc } from 'loro-crdt'
import { createDoc } from '../src/models/blocks.ts'
import { create } from '../src/models/edits.ts'
import { canonical } from '../src/models/canonical.ts'
import { Session, type Heard, type Posted } from '../src/api/session.ts'
import { b64 } from '../src/models/body.ts'
import { open, post } from '../src/api/live.ts'
import { Live, type Clock, type Sent } from '../src/hooks/live.ts'

const scope = 'test'

const settle = async () => {
  for (let i = 0; i < 20; i++) {
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
        await due[1].fn()
        await settle()
      }
      now = until
      await settle()
    },
  }
}

// What a save carried, as the test's action took it.
interface Save {
  actor: string
  record: string
  snapshot: Uint8Array
  contributors: string[]
}

// What outlives a server's restart: what the record keeps, the devices
// enrolled, and the browsers' clock.
interface Kept {
  stored: Map<string, Uint8Array>
  saves: Save[]
  devices: Map<string, Device>
  clock: ReturnType<typeof manual>
}

const kept = (): Kept => ({ stored: new Map(), saves: [], devices: new Map(), clock: manual() })

// The test's own feat: tasks t-1 and t-2 in circle web, read by everyone
// it names, a power in a circle held as `actor@circle` says, and a save
// action that takes a snapshot signed by the device enrolled for its
// actor, as the notary checks a write's signature, and keeps it.
function world(k: Kept = kept()) {
  const readers = new Set(['ana', 'ben', 'cleo'])
  const holds = new Set(['ana@web', 'ben@web'])
  let refuse: string | null = null
  const db = {} as Db
  let down = false
  const session = new Session({
    using: (actor, fn) => (actor === null || readers.has(actor) ? fn(db) : fn({ none: true } as unknown as Db)),
    may: async (_db, actor, power, circle) => power === 'discuss' && holds.has(`${actor}@${circle}`),
  })
  session.mount({
    kind: 'tasks',
    circle: async (d, record) => ((d as unknown as { none?: boolean }).none || !['t-1', 't-2'].includes(record) ? null : 'web'),
    saved: async (_d, record) => k.stored.get(record) ?? null,
    save: 'body',
  })
  // The feat's save action: its op, the request the browser signed, and
  // the proof that came with it.
  const act = async (actor: string, op: string, request: { record: string; snapshot: string; contributors: string[] }, proof: Proof): Promise<Sent> => {
    const device = k.devices.get(actor)
    const text = message({ scope, op, actor, device: proof.device, request: await digest(request, proof.salt), nonce: proof.nonce })
    if (!device || device.key !== proof.device || !(await verify(device.key, text, proof.sig))) {
      return { ok: false, reason: `the save is not signed by a device of ${actor}` }
    }
    if (refuse) {
      return { ok: false, reason: refuse }
    }
    const snapshot = b64.decode(request.snapshot)
    k.saves.push({ actor, record: request.record, snapshot, contributors: request.contributors })
    k.stored.set(request.record, snapshot)
    return { ok: true }
  }
  return {
    session,
    readers,
    holds,
    act,
    ...k,
    kept: k,
    refuse: (r: string | null) => (refuse = r),
    // The server stops: nothing it was asked answers again.
    stop: () => (down = true),
    get down() {
      return down
    },
  }
}

type World = ReturnType<typeof world>

const sent = (p: Posted): Sent => (p.state === 'refused' ? { ok: false, reason: p.reason } : { ok: true })

// An editor's browser on a record's body: its own document, `Live` over
// the session as the live route carries it, and its device, the one
// enrolled for its person unless it is handed another.
async function browser(w: World, actor: string, record = 't-1', device?: Device) {
  const doc: LoroDoc = createDoc()
  let enrolled = w.devices.get(actor)
  if (!enrolled) {
    enrolled = await generate(actor)
    w.devices.set(actor, enrolled)
  }
  const sign = signer(scope, actor, device ?? enrolled)
  // The server this browser reaches, which a restart replaces.
  let at = w
  const up = () => {
    if (at.down) {
      throw new Error('no answer')
    }
    return at
  }
  const live = new Live(
    doc,
    {
      post: async (update) => sent(await up().session.post('tasks', record, actor, update)),
      save: async (action, snapshot, contributors) => {
        const request = { record, snapshot: b64.encode(snapshot), contributors }
        return up().act(actor, `tasks:${action}:save`, request, await sign(`tasks:${action}:save`, request as unknown as Json))
      },
      saved: async () => sent(await up().session.saved('tasks', record, actor)),
    },
    { clock: w.clock },
  )
  doc.subscribeLocalUpdates(() => live.edited())
  const heard: Heard[] = []
  // Opens the body on a session, as the stream's events carry it.
  const join = async (to: World) => {
    at = to
    const j = await to.session.join('tasks', record, actor, b64.encode(doc.oplogVersion().encode()), doc.peerIdStr)
    assert.ok(j, `${actor} joins ${record}`)
    j.peer.listen((h) => {
      heard.push(h)
      if (h.type === 'update') {
        live.heard({ receipt: 0, update: b64.encode(h.update), contributors: h.contributors })
      } else if (h.type === 'saved') {
        live.kept({ saved: b64.encode(h.saved), contributors: h.contributors })
      } else {
        live.dropped(h.reason)
      }
    })
    await live.joined({ writable: j.peer.writable, actor, save: j.save, version: b64.encode(j.version), saved: b64.encode(j.saved), contributors: j.contributors })
    live.heard({ receipt: 0, update: b64.encode(j.update), contributors: j.contributors })
    return j.peer
  }
  let peer = await join(w)
  return {
    doc,
    live,
    heard,
    get peer() {
      return peer
    },
    async rejoin(to: World) {
      peer = await join(to)
    },
    // One edit, as one commit, which the browser posts a quarter second on.
    async type(text: string, at = 0) {
      create(doc, undefined, at, 'paragraph', {}, [{ text }])
      doc.commit()
      await w.clock.tick(250)
    },
    // The browser leaves the body: it saves, then its stream closes.
    async leave() {
      await live.leave()
      peer.leave()
    },
  }
}

const words = (doc: LoroDoc) => canonical(doc).blocks.map((b) => b.runs?.map((r) => r.text).join('') ?? '')

const read = (bytes: Uint8Array) => {
  const doc = createDoc()
  doc.import(bytes)
  return doc
}

describe('two peers', () => {
  it('merge through the session, which relays each update to both with who contributed', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    await ana.type('alpha')
    await ben.type('beta', 1)
    assert.deepEqual(words(ana.doc), ['alpha', 'beta'])
    assert.deepEqual(canonical(ben.doc), canonical(ana.doc))
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ana', 'ben'])
    const last = ana.heard.at(-1)
    assert.equal(last?.type, 'update')
    assert.deepEqual((last as { contributors: string[] }).contributors, ['ana', 'ben'])
  })

  it('converge on concurrent edits, and a late joiner catches up by its version vector', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    create(ana.doc, undefined, 0, 'paragraph', {}, [{ text: 'from ana' }])
    ana.doc.commit()
    create(ben.doc, undefined, 0, 'paragraph', {}, [{ text: 'from ben' }])
    ben.doc.commit()
    await w.clock.tick(250)
    assert.deepEqual(canonical(ana.doc), canonical(ben.doc))
    assert.equal(canonical(ana.doc).blocks.length, 2)
    const cleo = await browser(w, 'cleo')
    assert.deepEqual(canonical(cleo.doc), canonical(ana.doc))
  })

  it('refuses bytes that are not a Loro update, and a post from one who has not opened the body', async () => {
    const w = world()
    await browser(w, 'ana')
    assert.equal((await w.session.post('tasks', 't-1', 'ana', new Uint8Array([1, 2, 3]))).state, 'refused')
    assert.equal((await w.session.post('tasks', 't-1', 'ben', new Uint8Array())).state, 'refused')
    assert.equal((await w.session.saved('tasks', 't-1', 'ben')).state, 'refused')
  })
})

describe('saves', () => {
  it('are a browser’s, after a pause of 3 seconds, signed by its device, carrying the snapshot and who contributed', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    await ana.type('alpha')
    await w.clock.tick(1_750)
    await ben.type('beta', 1)
    await w.clock.tick(749)
    assert.equal(w.saves.length, 0)
    await w.clock.tick(1)
    assert.equal(w.saves.length, 1)
    assert.equal(w.saves[0].actor, 'ana')
    assert.equal(w.saves[0].record, 't-1')
    assert.deepEqual(w.saves[0].contributors, ['ana', 'ben'])
    assert.deepEqual(words(read(w.saves[0].snapshot)), ['alpha', 'beta'])
    // The session told everyone of the save, so ben's pause finds nothing new.
    assert.equal(ben.heard.at(-1)?.type, 'saved')
    assert.equal(ben.live.unsaved, false)
    await w.clock.tick(10_000)
    assert.equal(w.saves.length, 1)
  })

  it('name only who contributed since the last save', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    await ben.type('first')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.saves[0].contributors, ['ben'])
    await ana.type('after', 1)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 2)
    assert.equal(w.saves[1].actor, 'ana')
    assert.deepEqual(w.saves[1].contributors, ['ana'])
  })

  it('are made as a browser leaves, and none with nothing new', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    await ana.type('alpha')
    await ben.leave()
    assert.equal(w.saves.length, 1)
    assert.equal(w.saves[0].actor, 'ben')
    assert.deepEqual(w.saves[0].contributors, ['ana'])
    await ana.leave()
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.session.editors('tasks', 't-1'), [])
    await w.clock.tick(60_000)
    assert.equal(w.saves.length, 1)
    const again = await browser(w, 'ben')
    assert.deepEqual(words(again.doc), ['alpha'])
    await again.leave()
    assert.equal(w.saves.length, 1)
  })

  it('keep a refused save’s edits for the next pause, and say why', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    await ana.type('alpha')
    w.refuse('the task is archived')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 0)
    assert.equal(ana.live.problem, 'the task is archived')
    assert.equal(ana.live.unsaved, true)
    w.refuse(null)
    await w.clock.tick(10_000)
    assert.equal(w.saves.length, 0)
    await ana.type('beta', 1)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.deepEqual(words(read(w.saves[0].snapshot)), ['alpha', 'beta'])
    assert.equal(ana.live.problem, null)
  })

  it('are refused where the browser signs with a device not enrolled for its person', async () => {
    const w = world()
    await browser(w, 'ana')
    const other = await browser(w, 'ben', 't-1', await generate('ben'))
    await other.type('alpha')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 0)
    assert.match(other.live.problem ?? '', /not signed by a device of ben/)
  })
})

describe('the answer, asked again', () => {
  it('drops a peer at its next update once its mandate is revoked, refusing that update', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    await ana.type('kept')
    w.holds.delete('ana@web')
    await ana.type('refused')
    assert.match(ana.live.problem ?? '', /discuss in web/)
    assert.equal(ana.heard.at(-1)?.type, 'dropped')
    assert.equal(ana.live.writable, false)
    assert.deepEqual(words(ben.doc), ['kept'])
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ben'])
    await ben.type('on', 1)
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 1)
    assert.deepEqual(w.saves[0].contributors, ['ana', 'ben'])
  })

  it('drops a writable peer at a save once it may no longer discuss, and one that no longer reads', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    const ben = await browser(w, 'ben')
    const cleo = await browser(w, 'cleo')
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
    const cleo = await browser(w, 'cleo')
    assert.equal(cleo.peer.writable, false)
    assert.equal(cleo.live.writable, false)
    const ana = await browser(w, 'ana')
    await cleo.type('no')
    await w.clock.tick(3_000)
    assert.equal(w.saves.length, 0)
    assert.deepEqual(words(ana.doc), [])
    const forced = await w.session.post('tasks', 't-1', 'cleo', cleo.doc.export({ mode: 'update' }))
    assert.equal(forced.state, 'refused')
    assert.deepEqual(words(ana.doc), [])
  })

  it('opens nothing to one who reads no such record', async () => {
    const w = world()
    w.readers.delete('ana')
    assert.equal(await w.session.join('tasks', 't-1', 'ana'), null)
    assert.equal(await w.session.join('tasks', 't-9', 'ben'), null)
  })
})

describe('a restart', () => {
  it('starts the session again from the saved snapshot; a browser rejoins, posts what it lacks and saves it', async () => {
    const first = world()
    const ana = await browser(first, 'ana')
    const ben = await browser(first, 'ben')
    await ana.type('alpha')
    await first.clock.tick(3_000)
    assert.equal(first.saves.length, 1)
    await ben.type('beta', 1)
    await ana.type('gamma', 2)
    assert.equal(first.saves.length, 1)
    // The server stops here, before the pause; the next one keeps no
    // buffer, and ana's pause comes while her browser is not yet back.
    first.stop()
    const next = world(first.kept)
    const fresh = await browser(next, 'cleo')
    assert.deepEqual(words(fresh.doc), ['alpha'])
    await next.clock.tick(3_000)
    assert.match(ana.live.problem ?? '', /no answer/)
    await ben.rejoin(next)
    assert.deepEqual(words(fresh.doc), ['alpha', 'beta', 'gamma'])
    await next.clock.tick(3_000)
    assert.equal(next.saves.length, 2)
    assert.equal(next.saves[1].actor, 'ben')
    assert.deepEqual(next.saves[1].contributors, ['ana', 'ben'])
    assert.deepEqual(words(read(next.saves[1].snapshot)), ['alpha', 'beta', 'gamma'])
    await ana.rejoin(next)
    assert.equal(ana.live.unsaved, false)
    await next.clock.tick(10_000)
    assert.equal(next.saves.length, 2)
  })
})

describe('the live route', () => {
  it('streams joined and the catch-up, takes a posted update and a save, and answers as a form', async () => {
    const w = world()
    const ana = await browser(w, 'ana')
    await ana.type('alpha')
    const abort = new AbortController()
    const url = 'http://x/tasks/t-1/body/live?peer=42'
    const res = await open(w.session, { kind: 'tasks', record: 't-1', actor: 'ben', request: new Request(url, { signal: abort.signal }) })
    assert.equal(res.status, 200)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (!text.includes('event: update')) {
      text += decoder.decode((await reader.read()).value)
    }
    const joined = JSON.parse(/event: joined\ndata: (.*)\n/.exec(text)![1])
    assert.equal(joined.writable, true)
    assert.equal(joined.actor, 'ben')
    assert.equal(joined.save, 'body')
    assert.deepEqual(joined.contributors, ['ana'])
    const form = new FormData()
    const before = ana.doc.oplogVersion()
    create(ana.doc, undefined, 1, 'paragraph', {}, [{ text: 'beta' }])
    ana.doc.commit()
    form.set('update', b64.encode(ana.doc.export({ mode: 'update', from: before })))
    const ok = await post(w.session, { kind: 'tasks', record: 't-1', actor: 'ben', request: new Request('http://x', { method: 'POST', body: form }) })
    assert.deepEqual(await ok.json(), { type: 'success', status: 200 })
    const no = await post(w.session, { kind: 'tasks', record: 't-1', actor: 'cleo', request: new Request('http://x', { method: 'POST', body: form }) })
    assert.equal(((await no.json()) as { type: string }).type, 'failure')
    await ana.live.save()
    const saved = new FormData()
    saved.set('saved', '1')
    const told = await post(w.session, { kind: 'tasks', record: 't-1', actor: 'ben', request: new Request('http://x', { method: 'POST', body: saved }) })
    assert.deepEqual(await told.json(), { type: 'success', status: 200 })
    while (!text.includes('event: saved')) {
      text += decoder.decode((await reader.read()).value)
    }
    abort.abort()
    await settle()
    assert.deepEqual(w.session.editors('tasks', 't-1'), ['ana'])
    const none = await open(w.session, { kind: 'tasks', record: 't-9', actor: 'ben', request: new Request('http://x') })
    assert.equal(none.status, 404)
  })
})
