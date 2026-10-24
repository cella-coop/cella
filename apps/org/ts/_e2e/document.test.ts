// The document scenario, end to end on a seeded Lanterne: the 2027 rate card is
// edited together and adopted by d-2026-011. Edits are Loro updates that
// merge in any order; a version is the text at a frontier, hashed; adoption
// is ordered on its base and waits for the decision to close and pass on
// its roll. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { LoroDoc } from 'loro-crdt'
import { adopt, comment, draft, edit, version } from '@cella/org-document/api'
import { body, canonical, type Frontier } from '@cella/org-document/models'
import { close, vote } from '@cella/org-decision/api'
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
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_decision_member.passes($1) AS p', [d])).p
const adopted = async (d: string) => (await one<{ version: string } | undefined>('SELECT version FROM document.adopted WHERE document = $1', [d]))?.version

// The card's updates as a member's device holds them after syncing.
async function synced(peer: bigint) {
  const doc = new LoroDoc()
  doc.setPeerId(peer)
  const rows = await all<{ bytes: Buffer }>('SELECT bytes FROM document.update WHERE document = $1 ORDER BY receipt', [card])
  doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  return doc
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

test('the seed carries the documents over: internal-rules@3 is adopted, the card\'s draft is @2', async () => {
  assert.equal(await head(), 0)
  assert.equal(await adopted('internal-rules'), 'internal-rules@3')
  assert.equal(await adopted(card), undefined)
  const v2 = await one<{ body: string }>(`SELECT body FROM document.version WHERE id = 'rate-card-2027@2'`)
  assert.equal(canonical(await draft(app, card)), v2.body)
  const remark = await one<{ author: string; quote: string }>(`SELECT author, quote FROM document.comment WHERE version = 'rate-card-2027@2'`)
  assert.deepEqual(remark, { author: malik, quote: 'from 4 800 €' })
})

let merged = ''

test('two editors\' concurrent Loro updates merge to one text', async () => {
  const base = await synced(11n)
  const from = base.version()
  const hers = await synced(21n)
  const his = await synced(11n)

  // Camille raises the day rate while Malik, offline, adds the renewal rule.
  const t = hers.getText(body)
  const at = t.toString().indexOf('560 €')
  t.delete(at, 5)
  t.insert(at, '580 €')
  hers.commit()
  const m = his.getText(body)
  m.insert(m.length, '\nRetainers renewed before 1 March 2027 keep their 2026 rate.\n')
  his.commit()

  const a = await edit({ document: card, update: hers.export({ mode: 'update', from }) }, as(camille))
  const b = await edit({ document: card, update: his.export({ mode: 'update', from }) }, as(malik))
  assert.equal(a.state, 'settled')
  assert.equal(b.state, 'settled')
  assert.deepEqual([a.entry, b.entry], [1, 2])
  assert.match(b.value.digest, /^[0-9a-f]{64}$/)

  merged = await draft(app, card)
  assert.match(merged, /\| Day of work \| day \| 580 € \| 380 € \|/)
  assert.match(merged, /Retainers renewed before 1 March 2027 keep their 2026 rate\./)
  assert.doesNotMatch(merged, /560 €/)

  // Either device, merging the other's update, reaches the same text.
  hers.import(his.export({ mode: 'update', from }))
  his.import(hers.export({ mode: 'update', from }))
  assert.equal(hers.getText(body).toString(), merged)
  assert.equal(his.getText(body).toString(), merged)

  await assert.rejects(edit({ document: card, update: new Uint8Array([1, 2, 3]) }, as(malik)), /not a Loro update/)
  assert.equal(await head(), 2)
})

test('saving a version records its canonical text, hash and frontier', async () => {
  const saved = await version({ document: card }, as(malik))
  assert.equal(saved.state, 'settled')
  assert.equal(saved.value.version, 'rate-card-2027@3')
  const row = await one<{ body: string; hash: string; digest: string; frontier: Frontier; vv: Record<string, number> }>(
    `SELECT body, encode(hash, 'hex') AS hash, encode(cella.digest(body), 'hex') AS digest, frontier, vv
     FROM document.version WHERE id = 'rate-card-2027@3'`,
  )
  assert.equal(row.body, canonical(merged))
  assert.equal(row.hash, saved.value.hash)
  assert.equal(row.hash, row.digest)

  const device = await synced(31n)
  sameFrontier(row.frontier, device.frontiers() as Frontier)
  assert.deepEqual(row.vv, Object.fromEntries(device.version().toJSON()))

  // A version is the text at its frontier, however the draft moves on.
  const later = await synced(21n)
  later.getText(body).insert(0, '<!-- draft -->\n')
  later.commit()
  await edit({ document: card, update: later.export({ mode: 'update', from: device.version() }) }, as(camille))
  device.import(later.export({ mode: 'update', from: device.version() }))
  device.checkout(row.frontier)
  assert.equal(canonical(device.getText(body).toString()), row.body)

  const v2 = await one<{ frontier: Frontier; hash: string }>(`SELECT frontier, encode(hash, 'hex') AS hash FROM document.version WHERE id = 'rate-card-2027@2'`)
  const again = await version({ document: card, frontier: v2.frontier }, as(malik))
  assert.equal(again.state, 'settled')
  assert.equal(again.value.version, 'rate-card-2027@4')
  assert.equal(again.value.hash, v2.hash, 'the text at @2\'s frontier hashes as @2 did')
})

test('a comment quotes its version, and a quote the version lacks is refused', async () => {
  const noted = await comment({ version: 'rate-card-2027@3', quote: 'keep their 2026 rate', text: 'Nuvola is covered by this.' }, as(camille))
  assert.equal(noted.state, 'settled')
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

test('once Malik consents and d-2026-011 closes on 9 November, the adoption settles', async () => {
  const consents = await vote({ decision: 'd-2026-011', member: malik, stance: 'consent' }, as(malik))
  assert.equal(consents.state, 'settled')
  assert.equal(await passes('d-2026-011'), true)

  await on('2026-11-09')
  const closed = await close({ decision: 'd-2026-011' }, as(camille))
  assert.equal(closed.state, 'settled')

  const wrong = await adopt({ document: card, version: 'rate-card-2027@3', base: null, decision: 'd-2026-011' }, as(camille))
  assert.match(reason(wrong), /d-2026-011 does not adopt rate-card-2027@3/)

  const done = await adopt({ document: card, version: 'rate-card-2027@2', base: null, decision: 'd-2026-011' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.deepEqual(done.value, { document: card, version: 'rate-card-2027@2', adopted: '2026-11-09', receipt: done.value.receipt })
  assert.equal(await adopted(card), 'rate-card-2027@2')
  const logged = await one<{ rules: { owner: string }[] }>('SELECT rules FROM cella.log WHERE n = $1', [done.entry])
  assert.deepEqual(logged.rules.map((r) => r.owner), ['circle-decision-member', 'decision-document', 'document'])
})

test('a second adoption naming a stale base is refused, and uses no verdict number', async () => {
  const before = await head()
  const stale = await adopt({ document: card, version: 'rate-card-2027@2', base: null, decision: 'd-2026-011' }, as(malik))
  assert.equal(stale.state, 'refused')
  assert.match(reason(stale), /rate-card-2027 moved: its adopted version is rate-card-2027@2, not none/)
  assert.equal(stale.state === 'refused' && stale.verdict, before)
  assert.equal(await head(), before)
  assert.equal(Number((await one<{ count: string }>(`SELECT count(*) FROM document.adoption WHERE document = $1`, [card])).count), 1)
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const log = await one<{ count: string; max: string }>('SELECT count(*), max(n) FROM cella.log')
  assert.deepEqual([Number(log.count), Number(log.max)], [await head(), await head()])
})
