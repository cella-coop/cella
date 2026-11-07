// Who may write, end to end on a seeded Lanterne: every write is signed by
// a current device of its actor, the notary signs a receipt for it, and a
// write that needs a power settles only for a member holding it through a
// seat and a mandate, within the mandate's limit. Run by `cella test` on a
// fresh database.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, story } = createStory()
import assert from 'node:assert/strict'
import pg from 'pg'
import { issue } from '@cella/org-graft-invoice-transaction/api'
import { pay, post } from '@cella/org-transaction/api'
import { close as closing, vote } from '@cella/org-motion/api'
import { close } from '@cella/org-graft-membership-motion/api'
import { profile } from '@cella/org-person/api'
import { enrol, revoke } from '@cella/org-person/api'
import { add, update } from '@cella/org-contact/api'
import { comment } from '@cella/org-document/api'
import type { Deps } from '@cella/org-db'
import { generate, plain, signer, type Device, type Proof } from '@cella/org-sign'
import { device, reader, scope, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const julien = 'julien@lanterne.example'
const chloe = 'chloe@lanterne.example'
const hugo = 'hugo@lanterne.example'
const camille = 'camille@lanterne.example'
const malik = 'malik@lanterne.example'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string, label?: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor, label) })
// Hands the notary a proof made beforehand, as a server relaying a request.
const relay = (actor: string, proof: Proof): Deps => ({ db: reader(app, actor), actor, sign: async () => proof })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const passes = async (d: string) => (await one<{ p: boolean }>('SELECT membership_motion.passes($1) AS p', [d])).p
const verifies = async () => (await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v

const paying = (cents: number, label = 'Supplier: print proofs') => ({
  date: '2026-10-24',
  label,
  lines: [{ account: '626', side: 'debit' as const, cents }, { account: '401', side: 'credit' as const, cents }],
})

before(async () => {
  await su.connect()
  // The host stages a member suspended around the notary, as only a
  // superuser may.
  await su.query('SET cella.unbound = on')
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed enrols every fixture device, and Hugo\'s old laptop is revoked', async () => {
  assert.equal((await one<{ scope: string }>(`SELECT current_setting('cella.scope') AS scope`)).scope, scope)
  const devices = await all<{ label: string; revoked: string | null }>(
    `SELECT label, to_char(revoked, 'YYYY-MM-DD') AS revoked FROM person.device WHERE address = $1 ORDER BY label`,
    [hugo],
  )
  assert.deepEqual(devices, [{ label: 'laptop', revoked: null }, { label: 'old laptop', revoked: '2026-05-12' }])
  assert.equal(Number((await one<{ count: string }>('SELECT count(*) FROM person.device WHERE revoked IS NULL')).count), 16, 'and Inès\'s phone, enrolled when she took up her invitation')
  const laptop = await device(hugo, 'laptop')
  assert.equal((await one<{ key: string }>(`SELECT encode(key, 'hex') AS key FROM person.device WHERE address = $1 AND label = 'laptop'`, [hugo])).key, laptop.key)
})

test('Julien issues F-2026-0056 under his issue-invoice mandate, and it settles', async () => {
  const issued = await issue({
    series: 'F-2026',
    bill_to: 'Maison Ferrand',
    bill_address: '16 avenue Jean-Jaurès\n93500 Pantin',
    label: 'Packaging, range of six: print preparation',
    lines: [{ description: 'Print preparation, days', quantity: '2.5', unit_price: 520_00, vat_rate: 2000 }],
  }, as(julien))
  assert.equal(issued.state, 'settled')
  assert.equal(issued.state === 'settled' && issued.value.invoice, 'F-2026-0056')
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [issued.state === 'settled' && issued.entry])
  assert.deepEqual(logged.guards.map((r) => r.owner), ['invoice', 'invoice', 'invoice-transaction', 'membership'])
})

test('Chloé holds no issue-invoice mandate: her invoice is refused and uses no number', async () => {
  const before = await head()
  const refused = await issue({
    series: 'F-2026',
    bill_to: 'Atelier Ondine',
    bill_address: '11 rue Kléber\n93100 Montreuil',
    label: 'Newsletter',
    lines: [{ description: 'Newsletter', quantity: '1', unit_price: 300_00, vat_rate: 2000 }],
  }, as(chloe))
  assert.equal(refused.state, 'refused')
  assert.match(reason(refused), /chloe@lanterne\.example holds no mandate for issue-invoice/)
  assert.equal(await head(), before)
  assert.equal(Number((await one<{ next: number }>(`SELECT next FROM invoice.series WHERE name = 'F-2026'`)).next), 57)
})

test('Camille holds no record-entry: her post is refused and uses no verdict number', async () => {
  const before = await head()
  const booked = await post(paying(100_00), as(camille))
  assert.match(reason(booked), /camille@lanterne\.example holds no mandate for record-entry/)
  assert.equal(await head(), before)
})

test('Julien pays a supplier 2 400 € within his 3 000 € limit; 3 200 € is refused, and so is Camille', async () => {
  const within = await pay({ date: '2026-10-24', label: 'Imprimerie du Parc: posters', cents: 2400_00 }, as(julien))
  assert.equal(within.state, 'settled')
  const entry = within.state === 'settled' ? within.value.entry : ''
  const lines = await all<{ account: string; side: string; cents: string }>(
    'SELECT account, side, cella.cents(amount) AS cents FROM transaction.line WHERE entry = $1 ORDER BY n',
    [entry],
  )
  assert.deepEqual(lines, [{ account: '401', side: 'debit', cents: '240000' }, { account: '512', side: 'credit', cents: '240000' }])

  const before = await head()
  const beyond = await pay({ date: '2026-10-24', label: 'Imprimerie du Parc: brochures', cents: 3200_00 }, as(julien))
  assert.equal(beyond.state, 'refused')
  assert.match(reason(beyond), /julien@lanterne\.example holds no mandate for pay-supplier up to 3200\.00 €/)

  // Camille commits up to 20 000 € as gérante, but holds no pay-supplier.
  const gerante = await pay({ date: '2026-10-24', label: 'Imprimerie du Parc', cents: 100_00 }, as(camille))
  assert.match(reason(gerante), /camille@lanterne\.example holds no mandate for pay-supplier/)
  assert.equal(await head(), before)
})

test('a forged signature, a replayed nonce, a swapped payload and a revoked device are refused, using no verdict number', async () => {
  const op = 'transaction:transaction:post'
  const small = paying(50_00, 'Supplier: stamps')
  const before = await head()

  const julienKey = (await device(julien)).key
  const forged = { ...await sign(julien, undefined, chloe)(op, plain(small)), device: julienKey }
  assert.match(reason(await post(small, relay(julien, forged))), /the signature does not verify/)

  const signed = await sign(julien)(op, plain(small))
  assert.match(reason(await post(paying(60_00, 'Supplier: stamps'), relay(julien, signed))), /the signature does not verify/)

  const stranger = await post(small, { db: reader(app, hugo), actor: hugo, sign: sign(hugo, undefined, chloe) })
  assert.match(reason(stranger), /chloe@lanterne\.example's laptop signs for chloe@lanterne\.example, not for hugo@lanterne\.example/)

  const old = await vote({ motion: 'm-2026-012', member: hugo, stance: 'consent' }, as(hugo, 'old laptop'))
  assert.match(reason(old), /hugo@lanterne\.example's old laptop was revoked on 2026-05-12/)
  assert.equal(await head(), before)

  const first = await post(small, relay(julien, signed))
  assert.equal(first.state, 'settled')
  const again = await post(small, relay(julien, signed))
  assert.equal(again.state, 'refused')
  assert.match(reason(again), new RegExp(`nonce ${signed.nonce} was already counted, at receipt \\d+: a signature counts once`))
  assert.equal(await head(), before + 1)
})

test('a member votes only on a motion whose roll holds them, and only for themself', async () => {
  const before = await head()
  const off = await vote({ motion: 'm-2026-011', member: chloe, stance: 'consent' }, as(chloe))
  assert.equal(off.state, 'refused')
  assert.match(reason(off), /chloe@lanterne\.example is not on the roll of m-2026-011/)
  assert.equal(await head(), before)

  const on = await vote({ motion: 'm-2026-012', member: chloe, stance: 'consent' }, as(chloe))
  assert.equal(on.state, 'settled')
  const stance = await one<{ receipt: string }>(`SELECT max(receipt) AS receipt FROM motion.vote WHERE motion = 'm-2026-012' AND member = $1`, [chloe])
  const logged = await one<{ receipt: string }>('SELECT receipt FROM cella.log WHERE n = $1', [on.state === 'settled' && on.entry])
  assert.equal(stance.receipt, logged.receipt, 'the stance\'s receipt is the one the notary signed')

  const between = await head()
  const forOther = await vote({ motion: 'm-2026-012', member: chloe, stance: 'object' }, as(hugo))
  assert.equal(forOther.state, 'refused')
  assert.match(reason(forOther), /hugo@lanterne\.example may not vote for chloe@lanterne\.example/)
  assert.equal(await head(), between)
  const stances = await all(`SELECT FROM motion.vote WHERE motion = 'm-2026-012' AND member = $1 AND stance = 'object'`, [chloe])
  assert.equal(stances.length, 0)
})

test('a person edits their own profile, and no one else\'s', async () => {
  const own = await profile({ person: hugo, name: 'Hugo Lefèvre' }, as(hugo))
  assert.deepEqual(own.state === 'settled' && own.value, { person: hugo, fields: ['name'] })
  const other = await profile({ person: chloe, name: 'Chloé M.' }, as(hugo))
  assert.equal(other.state, 'refused')
  assert.match(reason(other), /hugo@lanterne\.example may not edit chloe@lanterne\.example's profile/)
  assert.equal((await one<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [chloe])).name, 'Chloé Moreau')
})

test('every active member edits contacts and documents through the member role\'s mandates in the assembly', async () => {
  const noted = await update({ id: 'nuvola', fields: { note: 'Renews in January' } }, as(chloe))
  assert.equal(noted.state, 'settled')
  const logged = await one<{ guards: { owner: string }[] }>('SELECT guards FROM cella.log WHERE n = $1', [noted.state === 'settled' && noted.entry])
  assert.deepEqual(logged.guards.map((r) => r.owner), ['membership'])
  const remarked = await comment({ version: 'rate-card-2027@2', quote: 'from 4 800 €', text: 'Agreed.' }, as(hugo))
  assert.equal(remarked.state, 'settled')
})

test('a suspended member\'s device and a non-member\'s are refused: nothing is allowed by omission', async () => {
  const thomas = 'thomas@lanterne.example'
  const ines = 'ines@lanterne.example'
  const before = await head()
  await su.query(`UPDATE membership.member SET status = 'suspended' WHERE address = $1`, [thomas])
  try {
    const suspended = await update({ id: 'nuvola', fields: { note: 'Suspended' } }, as(thomas))
    assert.match(reason(suspended), /thomas@lanterne\.example holds no mandate for edit-contact/)
    const silenced = await comment({ version: 'rate-card-2027@2', quote: 'from 4 800 €', text: 'Suspended.' }, as(thomas))
    assert.match(reason(silenced), /thomas@lanterne\.example holds no mandate for edit-document/)
  } finally {
    await su.query(`UPDATE membership.member SET status = 'active' WHERE address = $1`, [thomas])
  }

  // Inès is invited, not a member: she signs from the laptop her hire
  // enrolled, and holds no mandate.
  const outsider = { db: reader(app, ines), actor: ines, sign: sign(ines) }
  assert.match(reason(await add({ id: 'ondine-bis', name: 'Atelier Ondine' }, outsider)), /ines@lanterne\.example holds no mandate for edit-contact/)
  assert.match(reason(await comment({ version: 'rate-card-2027@2', quote: 'from 4 800 €', text: 'Hello' }, outsider)), /ines@lanterne\.example holds no mandate for edit-document/)
  assert.equal(await head(), before)
})

let phone: Device

test('Chloé enrols a phone, signed by her laptop, and it signs her writes', async () => {
  phone = await generate(chloe)
  const enrolled = await enrol({ address: chloe, label: 'phone', key: phone.key }, as(chloe))
  assert.equal(enrolled.state, 'settled')
  const row = await one<{ by: string; enrolled: string }>(
    `SELECT encode(enrolled_by, 'hex') AS by, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE key = decode($1, 'hex')`,
    [phone.key],
  )
  assert.deepEqual(row, { by: (await device(chloe)).key, enrolled: '2026-10-24' })

  const fromPhone = await vote({ motion: 'm-2026-012', member: chloe, stance: 'consent' }, { db: reader(app, chloe), actor: chloe, sign: signer(scope, chloe, phone) })
  assert.equal(fromPhone.state, 'settled')
})

test('an enrolment signed by another member\'s device is refused', async () => {
  const before = await head()
  const stray = await generate(chloe)
  const forOther = await enrol({ address: chloe, label: 'tablet', key: stray.key }, as(hugo))
  assert.match(reason(forOther), /hugo@lanterne\.example may not enrol a device for chloe@lanterne\.example/)
  const borrowed = await enrol({ address: chloe, label: 'tablet', key: stray.key }, { db: reader(app, chloe), actor: chloe, sign: sign(chloe, undefined, hugo) })
  assert.match(reason(borrowed), /hugo@lanterne\.example's laptop signs for hugo@lanterne\.example, not for chloe@lanterne\.example/)
  assert.equal(await head(), before)
  assert.equal((await all('SELECT FROM person.device WHERE key = decode($1, \'hex\')', [stray.key])).length, 0)
})

test('Chloé revokes her phone from her laptop, and the phone signs nothing after', async () => {
  const revoked = await revoke({ key: phone.key }, as(chloe))
  assert.equal(revoked.state, 'settled')
  const late = await vote({ motion: 'm-2026-012', member: chloe, stance: 'consent' }, { db: reader(app, chloe), actor: chloe, sign: signer(scope, chloe, phone) })
  assert.match(reason(late), /chloe@lanterne\.example's phone was revoked on 2026-10-24/)
})

test('a closed motion\'s outcome stays fixed when a member is suspended after', async () => {
  await on('2026-11-09')
  const before = await head()
  const outsider = await close({ motion: 'm-2026-011' }, as(chloe))
  assert.match(reason(outsider), /chloe@lanterne\.example holds no seat in coordination, so may not close m-2026-011/)
  assert.equal(await head(), before)
  // The motion feat's close alone counts no roll, and is refused.
  const uncounted = await closing({ motion: 'm-2026-011' }, as(camille))
  assert.match(reason(uncounted), /m-2026-011's close did not count its roll/)
  assert.equal(await head(), before)
  const closed = await close({ motion: 'm-2026-011' }, as(camille))
  assert.equal(closed.state, 'settled')
  assert.equal(await passes('m-2026-011'), false, 'Malik objects')
  const counted = await all<{ member: string }>(`SELECT member FROM membership_motion.counted WHERE motion = 'm-2026-011' ORDER BY member`)
  assert.equal(counted.length, 5)

  // Suspending the objector would let the others' consents pass it, were
  // the roll read now rather than at the close. The suspension is staged
  // around the notary, so it is undone after, and the log folds into the
  // state the scenario leaves.
  await su.query(`UPDATE membership.member SET status = 'suspended' WHERE address = $1`, [malik])
  try {
    const now = await one<{ p: boolean }>(
      `SELECT cella.consent(v.member, v.stance, v.receipt) AS p
       FROM motion.vote v
       JOIN motion.motion d ON d.id = v.motion
       JOIN membership_motion.roll r ON r.motion = v.motion AND r.member = v.member
       JOIN membership.member m ON m.address = v.member AND m.status = 'active'
       WHERE v.motion = 'm-2026-011' AND v.receipt < d.cutoff`,
    )
    assert.equal(now.p, true, 'read now, Camille\'s consent alone would carry it')
    assert.equal(await passes('m-2026-011'), false)
  } finally {
    await su.query(`UPDATE membership.member SET status = 'active' WHERE address = $1`, [malik])
  }
})

test('every verdict names its signed receipt, and the log verifies them both', async () => {
  assert.equal(await verifies(), true)
  const unmatched = await all(`SELECT FROM cella.log l LEFT JOIN cella.receipt r ON r.n = l.receipt WHERE r.n IS NULL OR r.op <> l.op`)
  assert.equal(unmatched.length, 0)
  const counts = await one<{ log: string; receipts: string }>('SELECT (SELECT count(*) FROM cella.log) AS log, (SELECT count(*) FROM cella.receipt) AS receipts')
  assert.equal(counts.log, counts.receipts)

  for (const tamper of [
    `UPDATE cella.receipt SET at = '2026-01-01T00:00:00.000000Z' WHERE n = (SELECT min(n) FROM cella.receipt)`,
    `UPDATE cella.receipt SET actor = 'mallory@lanterne.example' WHERE n = (SELECT min(n) FROM cella.receipt)`,
    `UPDATE cella.receipt SET signature = sig WHERE n = (SELECT min(n) FROM cella.receipt)`,
  ]) {
    await su.query('BEGIN')
    await su.query(tamper)
    assert.equal(await verifies(), false, tamper)
    await su.query('ROLLBACK')
  }
})

if (!process.env.CELLA_STORY) runTest('authority story', async (t) => story((name, step) => t.test(name, step)))
