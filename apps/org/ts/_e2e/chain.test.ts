// Lanterne's chain of mandates, end to end on a seeded Lanterne, through
// the handlers: the bills are handed down three mandates deep, the
// assembly's root to coordination, coordination's to Operations and
// Operations' to Brand's print buyer, each narrower than the one above;
// Sofia, the print buyer, is refused a power she holds by no mandate, an
// amount over her limit and a record her scope does not cover; closing
// coordination's open m-2026-013 grants finance a second mandate under
// the root, and closing the assembly's m-2026-014 ends the root and
// revokes every mandate under it the same day; its story, as `cella seed`
// plays it, leaves those two motions open for a reader to close. Run by
// `cella test e2e chain`.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, unseeded, story } = createStory()
import assert from 'node:assert/strict'
import pg from 'pg'
import { carried, close } from '@cella/org-graft-membership-motion/api'
import { record } from '@cella/org-bill/api'
import { approve } from '@cella/org-graft-bill-transaction/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const camille = 'camille@lanterne.example'
const sofia = 'sofia@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')

const bills = () =>
  all<{ grantee: string; issuer: string; parent: string | null; limit: number; scope: string | null; revoked: string | null }>(
    `SELECT m.grantee, m.issuer, p.grantee AS parent, cella.cents(m."limit")::int AS "limit", m.scope, to_char(m.revoked, 'YYYY-MM-DD') AS revoked
     FROM circle.mandate m LEFT JOIN circle.mandate p ON p.id = m.parent
     WHERE m.power = 'approve-bill' AND m.grantee <> 'manager' ORDER BY m.id`,
  )

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the bills are handed down three mandates deep, from the assembly to Brand\'s print buyer, each narrower than the one above', async () => {
  assert.deepEqual(await bills(), [
    { grantee: 'coordination', issuer: 'ag', parent: null, limit: 300000, scope: null, revoked: null },
    { grantee: 'operations', issuer: 'coordination', parent: 'coordination', limit: 200000, scope: null, revoked: null },
    { grantee: 'print-buyer', issuer: 'operations', parent: 'operations', limit: 120000, scope: 'brand', revoked: null },
  ])
  assert.deepEqual(
    await all(`SELECT grantee, issuer, depth FROM circle.chain((SELECT id FROM circle.mandate WHERE grantee = 'print-buyer' AND power = 'approve-bill'))`),
    [
      { grantee: 'coordination', issuer: 'ag', depth: 0 },
      { grantee: 'operations', issuer: 'coordination', depth: 1 },
      { grantee: 'print-buyer', issuer: 'operations', depth: 2 },
    ],
  )
  assert.equal((await one<{ r: string | null }>(`SELECT circle.overreach('2026-10-24') AS r`)).r, null)
})

test('Sofia, the print buyer, is refused a power she holds by no mandate, Brand\'s 1 440 € over her 1 200 €, and the assembly\'s rent outside her scope', async () => {
  const recording = await record(
    { supplier: 'Imprimerie du Parc', reference: 'FA-2026-1203', issued: '2026-10-23', label: 'Proofs', category: '606', circle: 'brand', lines: [{ description: 'Proofs', quantity: '1', unit_price: 120_00, vat_rate: 2000 }] },
    as(sofia),
  )
  assert.match(reason(recording), /the actor holds no mandate for record-bill/)
  assert.match(reason(await approve({ bill: 'bi-0001' }, as(sofia))), /the actor holds no mandate for approve-bill up to 1440\.00 €/)
  assert.match(reason(await approve({ bill: 'bi-0002' }, as(sofia))), /the actor holds approve-bill by no mandate covering ag's records/)
})

unseeded('closing m-2026-013 grants finance a second mandate under coordination\'s; closing m-2026-014 ends coordination\'s and revokes every mandate under it the same day', async () => {
  assert.equal((await close({ motion: 'm-2026-013' }, as(camille))).state, 'settled')
  assert.deepEqual((await carried('m-2026-013', as(camille))).map((d) => [d.op, d.state]), [['motion:policy:adopt', 'settled']])
  assert.deepEqual((await bills()).map((m) => [m.grantee, m.parent, m.limit]), [
    ['coordination', null, 300000],
    ['operations', 'coordination', 200000],
    ['print-buyer', 'operations', 120000],
    ['finance', 'coordination', 150000],
  ])
  assert.equal((await close({ motion: 'm-2026-014' }, as(camille))).state, 'settled')
  assert.deepEqual((await carried('m-2026-014', as(camille))).map((d) => [d.op, d.state]), [['motion:policy:end', 'settled']])
  assert.deepEqual((await bills()).map((m) => [m.grantee, m.revoked]), [
    ['coordination', '2026-10-24'],
    ['operations', '2026-10-24'],
    ['print-buyer', '2026-10-24'],
    ['finance', '2026-10-24'],
  ])
  assert.match(reason(await approve({ bill: 'bi-0002' }, as(sofia))), /the actor holds no mandate for approve-bill/)
})

if (!process.env.CELLA_STORY) runTest('chain story', async (t) => story((name, step) => t.test(name, step)))
