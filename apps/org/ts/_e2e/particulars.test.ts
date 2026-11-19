// The coop's particulars, end to end on a seeded Lanterne, through the
// handlers: they are the rule its founding motion adopted from
// scope.toml, protected by the extraordinary assembly's procedure, and
// the seller its invoices name; a motion of the assembly replacing them is
// decided by that procedure whatever its proposal names, and one that is
// unsound, or of another circle, is refused as it is proposed; passed, it
// changes the seller of the next invoice and of no invoice issued before,
// and the name every reader reads. Run by `cella test e2e particulars`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { issue } from '@cella/org-graft-invoice-transaction/api'
import { named } from '@cella/org-log/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const julien = at('julien')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

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
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}

const montreuil = '14 rue des Graviers, 93100 Montreuil, France'
const paris = '3 avenue Gambetta, 75020 Paris, France'
const wording = (seat: string, siren = '000000000') =>
  `The coop is called {particulars_name: Lanterne}, its legal name {particulars_legal_name: Lanterne Worker Co-operative Limited Company}, a {particulars_form: Worker co-operative limited company with variable capital}, whose seat is {particulars_seat: ${seat}}, registered under SIREN {particulars_siren: ${siren}} at the trade register of {particulars_rcs: Bobigny}, with the VAT number {particulars_vat: FR00000000000}`

const seller = async (invoice: string) => (await one<{ seller: Record<string, string | null> }>('SELECT seller FROM invoice.invoice WHERE id = $1', [invoice])).seller
const issued = async (label: string) =>
  settled(
    await issue(
      {
        series: 'F-2026',
        bill_to: 'Maison Ferrand',
        bill_address: '16 avenue Jean-Jaurès\n93500 Pantin',
        label,
        lines: [{ description: label, quantity: '1', unit_price: 400_00, vat_rate: 2000 }],
      },
      as(julien),
    ),
  ) as { invoice: string }

before(async () => {
  await su.connect()
  await on('2026-11-07')
})

after(async () => {
  await app.end()
  await su.end()
})

let founding = ''
let before_ = ''

test('Lanterne\'s particulars are its founding\'s, protected by the extraordinary assembly, and the seller its invoices name', async () => {
  const rule = await one<{ id: string; kind: string; protected: string; sentence: string }>(
    `SELECT p.id, p.kind, p.protected, policy.sentence(w.legal) AS sentence
     FROM circle.particulars r JOIN policy.policy p ON p.id = r.policy JOIN policy.wording w ON w.policy = p.id`,
  )
  founding = rule.id
  assert.match(founding, /^m-2021-001\/\d+$/)
  assert.equal(rule.kind, 'rule')
  assert.equal(rule.protected, 'extraordinary')
  assert.ok(rule.sentence.startsWith('The coop is called Lanterne, its legal name Lanterne Worker Co-operative Limited Company'), rule.sentence)
  const { logo, ...called } = await named(app)
  assert.deepEqual(called, { address: 'lanterne.example', name: 'Lanterne', legal: 'Lanterne Worker Co-operative Limited Company' })
  assert.match(logo ?? '', /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32"><rect .*<\/svg>$/, 'its logo is scope.toml\'s, on one line')
  assert.ok(rule.sentence.endsWith(`, and bears the mark ${logo}`), 'the founding words the logo last')

  before_ = (await issued('Upkeep, October')).invoice
  assert.deepEqual(await seller(before_), {
    name: 'Lanterne Worker Co-operative Limited Company',
    form: 'Worker co-operative limited company with variable capital',
    capital: null,
    siren: '000000000',
    rcs: 'Bobigny',
    vat: 'FR00000000000',
    seat: montreuil,
  })
  const kept = await one<{ seller: unknown }>(`SELECT seller FROM invoice.invoice WHERE id = 'F-2026-0041'`)
  assert.deepEqual(kept.seller, await seller(before_), 'the seeded invoices name the same seller')
})

test('particulars that are unsound, or not the assembly\'s, are refused as their motion is proposed', async () => {
  const replacing = (circle: string, siren: string) => ({
    circle,
    title: 'Move the seat',
    deadline: '2026-11-21',
    body: '',
    actions: [{ kind: 'policy', args: { kind: 'rule', wording: wording(paris, siren), replaces: founding } }],
  })
  assert.match(reason(await propose(replacing('ag', '12345'), as(camille))), /a SIREN is nine digits, as \{particulars_siren: 123 456 789\}, not 12345/)
  assert.notEqual((await propose(replacing('coordination', '000000000'), as(camille))).state, 'settled')
})

let moving = ''

test('a motion replacing them is decided by the extraordinary assembly\'s procedure, whatever its proposal names', async () => {
  const out = await propose(
    {
      circle: 'ag',
      title: 'Move the seat to Paris',
      procedure: 'ordinary',
      deadline: '2026-11-21',
      body: 'The studio moves to Gambetta; the statutes name the new seat.',
      actions: [{ kind: 'policy', args: { kind: 'rule', wording: wording(paris), replaces: founding, protected: 'extraordinary' } }],
    },
    as(camille),
  )
  moving = settled(out).motion
  assert.deepEqual(await one('SELECT procedure FROM motion.motion WHERE id = $1', [moving]), { procedure: 'extraordinary' })
})

test('passed, it changes the next invoice\'s seller and the name every reader reads, and no invoice issued before', async () => {
  for (const [i, member] of assembly.entries()) {
    settled(await vote({ motion: moving, member, stance: i < 8 ? 'for' : 'against' }, as(member)))
  }
  await on('2026-11-21')
  settled(await close({ motion: moving }, as(camille)))
  const out = await carried(moving, as(camille))
  assert.deepEqual(out.map((d) => [d.op, d.state, d.reason ?? '']), [['motion:policy:adopt', 'settled', '']])
  assert.deepEqual(
    await all(`SELECT policy, seat, to_char("from", 'YYYY-MM-DD') AS "from", to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.particulars ORDER BY id`),
    [
      { policy: founding, seat: montreuil, from: '2021-03-01', revoked: '2026-11-21' },
      { policy: `${moving}/1`, seat: paris, from: '2026-11-21', revoked: null },
    ],
  )

  const after_ = (await issued('Upkeep, November')).invoice
  assert.equal((await seller(after_)).seat, paris, 'the next invoice names the new seat')
  assert.equal((await seller(before_)).seat, montreuil, 'an invoice issued before keeps the seat it named')
  assert.equal((await one<{ seat: string }>(`SELECT seller ->> 'seat' AS seat FROM invoice.invoice WHERE id = 'F-2026-0041'`)).seat, montreuil)
  assert.equal((await named(app)).name, 'Lanterne')
})

test('the log verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
