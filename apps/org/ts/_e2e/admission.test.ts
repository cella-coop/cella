// The admission scenario, end to end on a seeded Lanterne: Inès Haddad is admitted
// by the assembly's consent vote, through the cella extension, and seated
// in the assembly, where her member role lets her edit documents. Run by
// `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { LoroDoc } from 'loro-crdt'
import { close, vote } from '@cella/org-decision/api'
import { edit } from '@cella/org-document/api'
import { body } from '@cella/org-document/models'
import { admit } from '@cella/org-member/api'
import { closed } from '@cella/org-graft-circle-decision-member/api'
import { add } from '@cella/org-graft-circle-member/api'
import type { Deps } from '@cella/org-db'
import { generate, signer } from '@cella/org-sign'
import { scope, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const ines = 'ines@lanterne.example'
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'

// The notary's date for the app role; a new connection picks it up.
async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: app, actor, sign: sign(actor) })
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_decision_member.passes($1) AS p', [d])).p
const status = async (m: string) => one<{ status: string; since: string | null; shares: number }>(
  `SELECT status, to_char(since, 'YYYY-MM-DD') AS since, shares FROM member.member WHERE address = $1`,
  [m],
)

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed starts an empty, valid log', async () => {
  assert.equal(await head(), 0)
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  assert.equal((await status(ines)).status, 'invited')
})

test('Hugo objects, and d-2026-012 fails until he consents', async () => {
  const objected = await vote({ decision: 'd-2026-012', member: hugo, stance: 'object' }, as(hugo))
  assert.equal(objected.state, 'settled')
  assert.equal(objected.entry, 1)
  assert.equal(await passes('d-2026-012'), false)
})

test('closing before the deadline is refused and uses no verdict number', async () => {
  const early = await close({ decision: 'd-2026-012' }, as(camille))
  assert.equal(early.state, 'refused')
  assert.match(early.state === 'refused' ? early.reason : '', /open until 2026-10-31/)
  assert.equal((await one<{ closed: string | null }>(`SELECT closed FROM decision.decision WHERE id = 'd-2026-012'`)).closed, null)

  const unclosed = await admit({ member: ines, shares: 20, decision: 'd-2026-012' }, as(camille))
  assert.equal(unclosed.state, 'refused')
  assert.match(unclosed.state === 'refused' ? unclosed.reason : '', /d-2026-012 is not closed/)
  assert.equal((await status(ines)).status, 'invited')
  assert.equal(await head(), 1)

  const consented = await vote({ decision: 'd-2026-012', member: hugo, stance: 'consent' }, as(hugo))
  assert.equal(consented.state, 'settled')
  assert.equal(consented.entry, 2, 'the next verdict follows the last, with no gap')
  assert.equal(await passes('d-2026-012'), true)
})

test('the app role cannot write the log', async () => {
  await assert.rejects(app.query(`INSERT INTO cella.log (n) VALUES (99)`), /permission denied/)
  await assert.rejects(app.query('UPDATE cella.head SET n = 0'), /permission denied/)
  await assert.rejects(app.query('DELETE FROM cella.rule'), /permission denied/)
})

test('d-2026-012 closes on 31 October, and the graft admits Inès and seats her in the assembly', async () => {
  await on('2026-10-31')
  const done = await close({ decision: 'd-2026-012' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.equal(done.state === 'settled' && done.entry, 3)

  const admitted = await closed('d-2026-012', as(camille))
  assert.equal(admitted.length, 1)
  assert.deepEqual(admitted[0].admitted, { state: 'settled', entry: 4, value: { member: ines, since: '2026-10-31' } })
  assert.deepEqual(await status(ines), { status: 'active', since: '2026-10-31', shares: 20 })
  const seat = admitted[0].seated
  assert.equal(seat?.state, 'settled')
  assert.equal(seat?.state === 'settled' && seat.entry, 5)
  const sits = await one<{ circle: string; role: string; since: string }>(
    `SELECT circle, role, to_char(since, 'YYYY-MM-DD') AS since FROM circle_member.position WHERE member = $1`,
    [ines],
  )
  assert.deepEqual(sits, { circle: 'ag', role: 'member', since: '2026-10-31' })
  const seated = await one<{ rules: { owner: string }[] }>('SELECT rules FROM cella.log WHERE n = 5')
  assert.deepEqual(seated.rules.map((r) => r.owner), ['circle-decision-member', 'circle-decision-member'])

  const late = await vote({ decision: 'd-2026-012', member: hugo, stance: 'object' }, as(hugo))
  assert.equal(late.state, 'refused', 'a confluent write may be refused at rung 1')
  assert.match(late.state === 'refused' ? late.reason : '', /d-2026-012 is closed/)
  assert.equal(await head(), 5)
})

test('a seat no admission gives is refused: not twice, not for a member the decision does not admit', async () => {
  const twice = await add({ circle: 'ag', member: ines, role: 'member', decision: 'd-2026-012' }, as(camille))
  assert.equal(twice.state, 'refused')
  assert.match(twice.state === 'refused' ? twice.reason : '', /ines@lanterne\.example already sits in ag as member/)
  const other = await add({ circle: 'ag', member: 'malik@lanterne.example', role: 'manager', decision: 'd-2026-012' }, as(camille))
  assert.match(other.state === 'refused' ? other.reason : '', /d-2026-012 does not admit malik@lanterne\.example/)
  const open = await add({ circle: 'ag', member: ines, role: 'member', decision: 'd-2026-011' }, as(camille))
  assert.match(open.state === 'refused' ? open.reason : '', /d-2026-011 is not closed/)
  assert.equal(await head(), 5)
})

test('seated in the assembly, Inès edits a document through the member role\'s mandate', async () => {
  // Her first device is enrolled here, out of band, as her invitation will
  // carry it.
  const laptop = await generate(ines)
  await su.query(`INSERT INTO key.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, 'laptop', '2026-10-31')`, [laptop.key, ines])
  const doc = new LoroDoc()
  const { rows } = await su.query<{ bytes: Buffer }>(`SELECT bytes FROM document.update WHERE document = 'internal-rules' ORDER BY receipt`)
  doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  const from = doc.version()
  doc.getText(body).insert(0, 'Welcome, Inès.\n')
  doc.commit()
  const edited = await edit({ document: 'internal-rules', update: doc.export({ mode: 'update', from }) }, { db: app, actor: ines, sign: signer(scope, ines, laptop) })
  assert.equal(edited.state, 'settled')
  assert.equal(edited.state === 'settled' && edited.entry, 6)
})

test('admitting under d-2026-011, which Malik blocks, is refused and rolls back', async () => {
  await on('2026-11-09')
  const done = await close({ decision: 'd-2026-011' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.equal(await passes('d-2026-011'), false)
  assert.deepEqual(await closed('d-2026-011', as(camille)), [])

  const since = (await status(ines)).since
  const refused = await admit({ member: ines, shares: 40, decision: 'd-2026-011' }, as(camille))
  assert.equal(refused.state, 'refused')
  assert.match(refused.state === 'refused' ? refused.reason : '', /d-2026-011 does not pass by consent/)
  assert.deepEqual(await status(ines), { status: 'active', since, shares: 20 })

  const log = await one<{ count: string; max: string }>('SELECT count(*), max(n) FROM cella.log')
  assert.deepEqual([Number(log.count), Number(log.max), await head()], [7, 7, 7])
})

test('the log verifies, records its rules, and catches tampering', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const admission = await one<{ rules: { owner: string }[]; date: string }>(
    `SELECT rules, to_char(date, 'YYYY-MM-DD') AS date FROM cella.log WHERE n = 4`,
  )
  assert.deepEqual(admission.rules.map((r) => r.owner), ['circle-decision-member', 'decision-member', 'member'])
  assert.equal(admission.date, '2026-10-31')
  // A vote's two, the close's one, the admission's three, the seat's one
  // beyond the carried rule it shares with the admission, and the edit's.
  const texts = await one<{ count: string }>('SELECT count(*) FROM cella.rule_text')
  assert.equal(Number(texts.count), 8)

  await su.query('BEGIN')
  await su.query(`UPDATE cella.log SET actor = 'mallory@lanterne.example' WHERE n = 4`)
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, false)
  await su.query('ROLLBACK')
})
