// The admission scenario, end to end on a seeded Lanterne: Inès Haddad is admitted
// by the assembly's consent vote, through the cella extension, and in the
// same verdict seated in the assembly; she edits documents from the phone
// on which she took up her invitation, which enrolled it, and her laptop
// came with her hire. Run by `cella test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { edit } from '@cella/org-document/api'
import { createDoc, edits } from '@cella/org-document/models'
import { admit } from '@cella/org-membership/api'
import { close } from '@cella/org-graft-circle-membership-motion/api'
import { add } from '@cella/org-graft-circle-membership/api'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
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
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT circle_membership_motion.passes($1) AS p', [d])).p
const status = async (m: string) => one<{ status: string; since: string | null; shares: number }>(
  `SELECT status, to_char(since, 'YYYY-MM-DD') AS since, shares FROM membership.member WHERE address = $1`,
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

test('the seed is the log\'s first entry, and it verifies; Inès is invited, her phone enrolled when she took up the invitation, her laptop with her hire', async () => {
  assert.equal(await head(), 1)
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  assert.equal((await status(ines)).status, 'invited')
  const phone = await one<{ key: string }>(`SELECT encode(key, 'hex') AS key FROM membership.invitation WHERE member = $1`, [ines])
  assert.equal(phone.key, (await fixture(ines, 'phone')).key)
  assert.deepEqual(
    await all(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE address = $1 ORDER BY enrolled`, [ines]),
    [
      { label: 'laptop', enrolled: '2025-09-01' },
      { label: 'phone', enrolled: '2026-10-01' },
    ],
  )
})

test('Hugo objects, and m-2026-012 fails until he consents', async () => {
  const objected = await vote({ motion: 'm-2026-012', member: hugo, stance: 'object' }, as(hugo))
  assert.equal(objected.state, 'settled')
  assert.equal(objected.entry, 2)
  assert.equal(await passes('m-2026-012'), false)
})

test('closing before the deadline is refused and uses no verdict number', async () => {
  const early = await close({ motion: 'm-2026-012' }, as(camille))
  assert.equal(early.state, 'refused')
  assert.match(early.state === 'refused' ? early.reason : '', /open until 2026-10-31/)
  assert.equal((await one<{ closed: string | null }>(`SELECT closed FROM motion.motion WHERE id = 'm-2026-012'`)).closed, null)

  const unclosed = await admit({ member: ines, shares: 20, motion: 'm-2026-012' }, as(camille))
  assert.equal(unclosed.state, 'refused')
  assert.match(unclosed.state === 'refused' ? unclosed.reason : '', /m-2026-012 is not closed/)
  assert.equal((await status(ines)).status, 'invited')
  assert.equal(await head(), 2)

  const consented = await vote({ motion: 'm-2026-012', member: hugo, stance: 'consent' }, as(hugo))
  assert.equal(consented.state, 'settled')
  assert.equal(consented.entry, 3, 'the next verdict follows the last, with no gap')
  assert.equal(await passes('m-2026-012'), true)
})

test('the app role cannot write the log', async () => {
  await assert.rejects(app.query(`INSERT INTO cella.log (n) VALUES (99)`), /permission denied/)
  await assert.rejects(app.query('UPDATE cella.head SET n = 0'), /permission denied/)
  await assert.rejects(app.query('DELETE FROM cella.guard'), /permission denied/)
})

test('m-2026-012 closes on 31 October and, in the same verdict, admits Inès and seats her in the assembly', async () => {
  await on('2026-10-31')
  const done = await close({ motion: 'm-2026-012' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.equal(done.state === 'settled' && done.entry, 4)
  const position = done.state === 'settled' ? done.value.admitted[0]?.position : 0
  assert.deepEqual(done.state === 'settled' && done.value.admitted, [{ member: ines, shares: 20, position }])

  assert.deepEqual(await status(ines), { status: 'active', since: '2026-10-31', shares: 20 })
  const sits = await one<{ circle: string; role: string; since: string }>(
    `SELECT circle, role, to_char(since, 'YYYY-MM-DD') AS since FROM circle_membership.position WHERE member = $1`,
    [ines],
  )
  assert.deepEqual(sits, { circle: 'ag', role: 'member', since: '2026-10-31' })
  const phone = await one<{ label: string; enrolled: string; by: string | null }>(
    `SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled, encode(enrolled_by, 'hex') AS by FROM person.device WHERE address = $1 AND label = 'phone'`,
    [ines],
  )
  assert.deepEqual(phone, { label: 'phone', enrolled: '2026-10-01', by: null }, 'the phone is the one her invitation enrolled')

  const entry = await one<{ op: string; guards: { owner: string }[] }>('SELECT op, guards FROM cella.log WHERE n = 4')
  assert.equal(entry.op, 'motion:motion:close')
  assert.deepEqual([...new Set(entry.guards.map((r) => r.owner))].sort(), ['circle-membership-motion', 'membership-motion', 'motion'])

  const late = await vote({ motion: 'm-2026-012', member: hugo, stance: 'object' }, as(hugo))
  assert.equal(late.state, 'refused', 'a confluent write may be refused at rung 1')
  assert.match(late.state === 'refused' ? late.reason : '', /m-2026-012 is closed/)
  assert.equal(await head(), 4)
})

test('a seat no motion gives is refused: not twice, not one the motion does not name', async () => {
  const twice = await add({ circle: 'ag', member: ines, role: 'member', motion: 'm-2026-012' }, as(camille))
  assert.equal(twice.state, 'refused')
  assert.match(twice.state === 'refused' ? twice.reason : '', /ines@lanterne\.example already sits in ag as member/)
  const other = await add({ circle: 'ag', member: 'malik@lanterne.example', role: 'manager', motion: 'm-2026-012' }, as(camille))
  assert.match(other.state === 'refused' ? other.reason : '', /m-2026-012 does not seat malik@lanterne\.example in ag as manager/)
  const open = await add({ circle: 'ag', member: ines, role: 'member', motion: 'm-2026-011' }, as(camille))
  assert.match(open.state === 'refused' ? open.reason : '', /m-2026-011 is not closed/)
  assert.equal(await head(), 4)
})

test('seated in the assembly, Inès edits a document from the phone she took up her invitation on', async () => {
  const doc = createDoc()
  const { rows } = await su.query<{ bytes: Buffer }>(`SELECT bytes FROM document.update WHERE document = 'internal-rules' ORDER BY receipt`)
  doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)))
  const from = doc.version()
  edits.create(doc, undefined, 0, 'paragraph', {}, [{ text: 'Welcome, Inès.' }])
  doc.commit()
  const phone: Deps = { db: app, actor: ines, sign: signer(scope, ines, fixture(ines, 'phone')) }
  const edited = await edit({ document: 'internal-rules', update: doc.export({ mode: 'update', from }) }, phone)
  assert.equal(edited.state, 'settled')
  assert.equal(edited.state === 'settled' && edited.entry, 5)
})

test('m-2026-011, which Malik blocks, closes admitting no one, and admitting under it is refused', async () => {
  await on('2026-11-09')
  const done = await close({ motion: 'm-2026-011' }, as(camille))
  assert.equal(done.state, 'settled')
  assert.deepEqual(done.state === 'settled' && done.value.admitted, [])
  assert.equal(await passes('m-2026-011'), false)

  const since = (await status(ines)).since
  const refused = await admit({ member: ines, shares: 40, motion: 'm-2026-011' }, as(camille))
  assert.equal(refused.state, 'refused')
  assert.match(refused.state === 'refused' ? refused.reason : '', /m-2026-011 does not pass by consent/)
  assert.deepEqual(await status(ines), { status: 'active', since, shares: 20 })

  const log = await one<{ count: string; max: string }>('SELECT count(*), max(n) FROM cella.log')
  assert.deepEqual([Number(log.count), Number(log.max), await head()], [6, 6, 6])
})

test('the log verifies, records its guards, and catches tampering', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const admission = await one<{ date: string }>(`SELECT to_char(date, 'YYYY-MM-DD') AS date FROM cella.log WHERE n = 4`)
  assert.equal(admission.date, '2026-10-31')

  await su.query('BEGIN')
  await su.query(`UPDATE cella.log SET actor = 'mallory@lanterne.example' WHERE n = 4`)
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, false)
  await su.query('ROLLBACK')
})
