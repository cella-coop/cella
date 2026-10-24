// The first slice, end to end on a seeded Lanterne: Inès Haddad is admitted
// by the assembly's consent vote, through the cella extension. Run by
// `just test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close, vote } from '@cella/org-decision/api'
import { admit } from '@cella/org-member/api'
import { closed } from '@cella/org-graft-decision-member/api'
import type { Deps } from '@cella/org-db'

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

const as = (actor: string): Deps => ({ db: app, actor })
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT decision_member.passes($1) AS p', [d])).p
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

test('d-2026-012 closes on 31 October, and the graft admits Inès', async () => {
  await on('2026-10-31')
  const done = await close({ decision: 'd-2026-012' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.equal(done.state === 'settled' && done.entry, 3)

  const admitted = await closed('d-2026-012', as(camille))
  assert.equal(admitted.length, 1)
  assert.deepEqual(admitted[0], { state: 'settled', entry: 4, value: { member: ines, since: '2026-10-31' } })
  assert.deepEqual(await status(ines), { status: 'active', since: '2026-10-31', shares: 20 })

  const late = await vote({ decision: 'd-2026-012', member: hugo, stance: 'object' }, as(hugo))
  assert.equal(late.state, 'refused', 'a confluent write may be refused at rung 1')
  assert.match(late.state === 'refused' ? late.reason : '', /d-2026-012 is closed/)
  assert.equal(await head(), 4)
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
  assert.deepEqual([Number(log.count), Number(log.max), await head()], [5, 5, 5])
})

test('the log verifies, records its rules, and catches tampering', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const admission = await one<{ rules: { owner: string }[]; date: string }>(
    `SELECT rules, to_char(date, 'YYYY-MM-DD') AS date FROM cella.log WHERE n = 4`,
  )
  assert.deepEqual(admission.rules.map((r) => r.owner), ['decision-member', 'member'])
  assert.equal(admission.date, '2026-10-31')
  const texts = await one<{ count: string }>('SELECT count(*) FROM cella.rule_text')
  assert.equal(Number(texts.count), 3)

  await su.query('BEGIN')
  await su.query(`UPDATE cella.log SET actor = 'mallory@lanterne.example' WHERE n = 4`)
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, false)
  await su.query('ROLLBACK')
})
