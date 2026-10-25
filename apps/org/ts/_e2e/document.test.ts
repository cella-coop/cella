// The document scenario, end to end on a seeded Lanterne: the 2027 rate card
// is edited together and adopted by d-2026-011. Edits are Loro updates to a
// tree of blocks that merge in any order; a version is a snapshot at a
// frontier, which the database canonicalises and hashes; a decision names
// the content it adopts by that hash, and adoption is ordered on its base
// and waits for the decision to close and pass on its roll. Run by `cella
// test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { adopt, comment, draft, edit, version } from '@cella/org-document/api'
import { canonical, createDoc, edits, hash, jcs, order, text, type Frontier } from '@cella/org-document/models'
import { close, propose, vote } from '@cella/org-decision/api'
import { slice } from '@cella/org-graft-decision-document/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const malik = 'malik@lanterne.example'
const camille = 'camille@lanterne.example'
const card = 'rate-card-2027'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_decision_membership.passes($1) AS p', [d])).p
const adopted = async (d: string) => (await one<{ version: string } | undefined>('SELECT version FROM document.adopted WHERE document = $1', [d]))?.version
const decisions = (db: pg.Client) => slice.extends?.decisions.about?.(db) ?? Promise.resolve({})
const hashOf = async (v: string) => (await one<{ hash: string }>(`SELECT encode(hash, 'hex') AS hash FROM document.version WHERE id = $1`, [v])).hash

// The card's updates as a member's device holds them after syncing.
async function synced(peer: bigint) {
  const doc = createDoc(peer)
  const rows = await all<{ bytes: Buffer }>('SELECT bytes FROM document.update WHERE document = $1 ORDER BY receipt', [card])
  doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  return doc
}

// The block whose text starts so.
const block = (doc: ReturnType<typeof createDoc>, start: string) => {
  const found = order(doc).find((r) => text(doc, r.id).toString().startsWith(start))
  assert.ok(found, `no block starts “${start}”`)
  return found.id
}

const sameFrontier = (a: Frontier, b: Frontier) =>
  assert.deepEqual([...a].sort((x, y) => x.peer.localeCompare(y.peer)), [...b].sort((x, y) => x.peer.localeCompare(y.peer)))

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed carries the documents over: internal-rules@3 is adopted, the card\'s draft is @2, named by its hash', async () => {
  assert.equal(await head(), 1)
  assert.equal(await adopted('internal-rules'), 'internal-rules@3')
  assert.equal(await adopted(card), undefined)
  const v2 = await one<{ canonical: string; hash: string }>(`SELECT canonical, encode(hash, 'hex') AS hash FROM document.version WHERE id = 'rate-card-2027@2'`)
  const now = await draft(app, card)
  assert.equal(jcs(now), v2.canonical)
  assert.equal(hash(await synced(9n)), v2.hash, 'the browser previews the hash the database gave')
  const asked = await one<{ hash: string }>(`SELECT encode(hash, 'hex') AS hash FROM decision_document.adoption WHERE decision = 'd-2026-011'`)
  assert.equal(asked.hash, v2.hash, 'd-2026-011 names the content of @2')
  const remark = await one<{ author: string; quote: string; anchor: { block: string } | null }>(`SELECT author, quote, anchor FROM document.comment WHERE version = 'rate-card-2027@2'`)
  assert.equal(remark.author, malik)
  assert.equal(remark.quote, 'from 4 800 €')
  assert.ok(remark.anchor?.block, 'the comment is anchored to a block by cursors')
})

test('two editors\' concurrent Loro updates merge to one document', async () => {
  const base = await synced(11n)
  const from = base.version()
  const hers = await synced(21n)
  const his = await synced(11n)

  // Camille raises the day rate while Malik, offline, adds the renewal rule.
  const t = text(hers, block(hers, 'Standard: 560 €'))
  t.delete(10, 3)
  t.insert(10, '580')
  hers.commit()
  const last = order(his).filter((r) => r.depth === 0).at(-1)
  assert.ok(last)
  edits.after(his, last.id, 'paragraph', {}, [{ text: 'Retainers renewed before 1 March 2027 keep their 2026 rate.' }])
  his.commit()

  const a = await edit({ document: card, update: hers.export({ mode: 'update', from }) }, as(camille))
  const b = await edit({ document: card, update: his.export({ mode: 'update', from }) }, as(malik))
  assert.equal(a.state, 'settled')
  assert.equal(b.state, 'settled')
  assert.deepEqual([a.entry, b.entry], [2, 3])
  assert.match(b.value.digest, /^[0-9a-f]{64}$/)

  const merged = jcs(await draft(app, card))
  assert.match(merged, /"Standard: 580 €"/)
  assert.match(merged, /Retainers renewed before 1 March 2027 keep their 2026 rate\./)
  assert.doesNotMatch(merged, /560 €/)

  // Either device, merging the other's update, reaches the same document.
  hers.import(his.export({ mode: 'update', from }))
  his.import(hers.export({ mode: 'update', from }))
  assert.equal(jcs(canonical(hers)), merged)
  assert.equal(jcs(canonical(his)), merged)

  await assert.rejects(edit({ document: card, update: new Uint8Array([1, 2, 3]) }, as(malik)), /not a Loro update/)
  const broken = await synced(41n)
  const v = broken.version()
  edits.retype(broken, block(broken, 'Website'), 'heading', { level: 1.5 })
  broken.commit()
  await assert.rejects(edit({ document: card, update: broken.export({ mode: 'update', from: v }) }, as(malik)), /no canonical form/)
  assert.equal(await head(), 3)
})

test('saving a version snapshots the draft, and the database names it by its canonical hash', async () => {
  const saved = await version({ document: card }, as(malik))
  assert.equal(saved.state, 'settled')
  assert.equal(saved.value.version, 'rate-card-2027@3')
  const device = await synced(31n)
  const row = await one<{ canonical: string; hash: string; frontier: Frontier; vv: Record<string, number> }>(
    `SELECT canonical, encode(hash, 'hex') AS hash, frontier, vv FROM document.version WHERE id = 'rate-card-2027@3'`,
  )
  assert.equal(row.canonical, jcs(canonical(device)))
  assert.equal(row.hash, saved.value.hash)
  assert.equal(row.hash, hash(device))
  sameFrontier(row.frontier, device.frontiers() as Frontier)
  assert.deepEqual(row.vv, Object.fromEntries(device.version().toJSON()))

  // A version is the document at its frontier, however the draft moves on.
  const later = await synced(21n)
  edits.create(later, undefined, 0, 'paragraph', {}, [{ text: 'Draft' }])
  later.commit()
  await edit({ document: card, update: later.export({ mode: 'update', from: device.version() }) }, as(camille))
  device.import(later.export({ mode: 'update', from: device.version() }))
  assert.notEqual(hash(device), row.hash)
  device.checkout(row.frontier)
  assert.equal(hash(device), row.hash)
  device.checkoutToLatest()

  const v2 = await one<{ frontier: Frontier; hash: string }>(`SELECT frontier, encode(hash, 'hex') AS hash FROM document.version WHERE id = 'rate-card-2027@2'`)
  const again = await version({ document: card, frontier: v2.frontier }, as(malik))
  assert.equal(again.state, 'settled')
  assert.equal(again.value.version, 'rate-card-2027@4')
  assert.equal(again.value.hash, v2.hash, 'the document at @2\'s frontier hashes as @2 did')
})

test('a comment quotes its version, anchored by cursors; a quote the version lacks is refused', async () => {
  const noted = await comment({ version: 'rate-card-2027@3', quote: 'keep their 2026 rate', text: 'Nuvola is covered by this.' }, as(camille))
  assert.equal(noted.state, 'settled')
  const anchor = await one<{ anchor: { block: string; from: string; to: string } }>('SELECT anchor FROM document.comment WHERE id = $1', [noted.value.comment])
  assert.ok(anchor.anchor.from && anchor.anchor.to)
  const before = await head()
  const stray = await comment({ version: 'rate-card-2027@1', quote: 'keep their 2026 rate', text: 'Is this here?' }, as(camille))
  assert.equal(stray.state, 'refused', 'a confluent write may be refused at rung 1')
  assert.match(reason(stray), /rate-card-2027@1 does not hold the quoted text/)
  assert.equal(await head(), before)
})

test('adopting rate-card-2027@2 under d-2026-011 is refused while Malik objects and the decision fails', async () => {
  assert.equal(await passes('d-2026-011'), false)
  const before = await head()
  const early = await adopt({ document: card, version: 'rate-card-2027@2', base: null, decision: 'd-2026-011' }, as(camille))
  assert.equal(early.state, 'refused')
  assert.match(reason(early), /d-2026-011 is not closed/)
  assert.equal(early.state === 'refused' && early.verdict, before)
  assert.equal(await head(), before)
  assert.equal(await adopted(card), undefined)
})

test('once Malik consents and d-2026-011 closes, only content hashing as it names is adopted', async () => {
  const consents = await vote({ decision: 'd-2026-011', member: malik, stance: 'consent' }, as(malik))
  assert.equal(consents.state, 'settled')
  assert.equal(await passes('d-2026-011'), true)

  await on('2026-11-09')
  const closed = await close({ decision: 'd-2026-011' }, as(camille))
  assert.equal(closed.state, 'settled')

  const v2 = await hashOf('rate-card-2027@2')
  const wrong = await adopt({ document: card, version: 'rate-card-2027@3', base: null, decision: 'd-2026-011' }, as(camille))
  assert.match(reason(wrong), new RegExp(`d-2026-011 adopts rate-card-2027 as ${v2.slice(0, 12)}, not rate-card-2027@3`))

  // @4 was saved at @2's frontier: the same content, the same hash, so the
  // decision's consent covers it; the base rule still names the first.
  const done = await adopt({ document: card, version: 'rate-card-2027@2', base: null, decision: 'd-2026-011' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.deepEqual(done.value, { document: card, version: 'rate-card-2027@2', hash: v2, adopted: '2026-11-09', receipt: done.value.receipt })
  assert.equal(await adopted(card), 'rate-card-2027@2')
  const logged = await one<{ rules: { owner: string }[] }>('SELECT rules FROM cella.log WHERE n = $1', [done.entry])
  assert.deepEqual(logged.rules.map((r) => r.owner), ['circle-decision-membership', 'decision-document', 'document'])
})

test('a second adoption naming a stale base is refused, and uses no verdict number', async () => {
  const before = await head()
  const stale = await adopt({ document: card, version: 'rate-card-2027@4', base: null, decision: 'd-2026-011' }, as(malik))
  assert.equal(stale.state, 'refused')
  assert.match(reason(stale), /rate-card-2027 moved: its adopted version is rate-card-2027@2, not none/)
  assert.equal(stale.state === 'refused' && stale.verdict, before)
  assert.equal(await head(), before)
  assert.equal(Number((await one<{ count: string }>(`SELECT count(*) FROM document.adoption WHERE document = $1`, [card])).count), 1)
})

test('a new decision proposes adopting a version picked from the versions; one that does not exist is refused', async () => {
  const offered = (await decisions(app)) as { versions: { value: string; label: string }[] }
  assert.ok(offered.versions.some((v) => v.value === 'internal-rules@3' && /, version 3$/.test(v.label)))
  const motion = (version: string) => ({ circle: 'ag', title: `Adopt ${version}`, procedure: 'consent', deadline: '2026-12-31', body: '', motions: [{ kind: 'adopt', args: { version } }] })
  const out = await propose(motion('internal-rules@3'), as(camille))
  assert.equal(out.state, 'settled', reason(out))
  const id = (out as { value: { decision: string } }).value.decision
  assert.deepEqual(
    await one(`SELECT document, version, encode(hash, 'hex') AS hash FROM decision_document.adoption WHERE decision = $1`, [id]),
    { document: 'internal-rules', version: 'internal-rules@3', hash: await hashOf('internal-rules@3') },
  )
  const before = await head()
  assert.match(reason(await propose(motion('internal-rules@9'), as(camille))), /no version internal-rules@9/)
  assert.equal(await head(), before)
})

test('minutes are adopted as any document is: the assembly adopts its June minutes, picked from the versions', async () => {
  const minutes = 'minutes-ag-2026-06-20'
  const offered = (await decisions(app)) as { versions: { value: string; label: string }[] }
  assert.ok(offered.versions.some((v) => v.value === `${minutes}@1`))
  const proposed = await propose(
    { circle: 'ag', title: 'Adopt the minutes of 20 June', procedure: 'consent', deadline: '2026-11-16', body: '', motions: [{ kind: 'adopt', args: { version: `${minutes}@1` } }] },
    as(camille),
  )
  assert.equal(proposed.state, 'settled', reason(proposed))
  const decision = (proposed as { value: { decision: string } }).value.decision
  const roll = await all<{ member: string }>(
    `SELECT r.member FROM circle_decision_membership.roll r JOIN membership.member m ON m.address = r.member WHERE r.decision = $1 AND m.status = 'active'`,
    [decision],
  )
  for (const { member } of roll) {
    assert.equal((await vote({ decision, member, stance: 'consent' }, as(member))).state, 'settled')
  }
  await on('2026-11-16')
  assert.equal((await close({ decision }, as(camille))).state, 'settled')
  const done = await adopt({ document: minutes, version: `${minutes}@1`, base: null, decision }, as(camille))
  assert.equal(done.state, 'settled', reason(done))
  assert.equal(await adopted(minutes), `${minutes}@1`)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const log = await one<{ count: string; max: string }>('SELECT count(*), max(n) FROM cella.log')
  assert.deepEqual([Number(log.count), Number(log.max)], [await head(), await head()])
})
