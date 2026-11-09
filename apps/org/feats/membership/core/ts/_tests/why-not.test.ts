// Why a power is refused, on a database holding the app's core, its
// circles, and the person and membership feats: `circle_person.why_not`
// names the mandate missing or exceeded and what would fix it, with the
// values it read, one cause each: a mandate held as a suspended member, a
// limit the amount exceeds, a scope not covering the record's circle, a
// mandate revoked, expired or yet to apply, a tenure ended, and none at
// all, with the roles that hold it or the assembly that may grant it. It
// names roles, circles and mandates, never a person. Run by `cella test
// slice membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const julien = 'julien@why'
const hugo = 'hugo@why'
const paul = 'paul@why'
const thomas = 'thomas@why'
const amina = 'amina@why'

const whyNot = async (actor: string, power: string, about: string, cents: number | null = null, day = '2026-10-24') =>
  (await db.query<{ w: string | null }>('SELECT circle_person.why_not($1, $2, $3, $4, $5) AS w', [actor, power, cents, about, day])).rows[0].w
const id = async (policy: string) => (await db.query<{ id: string }>('SELECT id FROM circle.mandate WHERE policy = $1', [policy])).rows[0].id

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  for (const c of ['brand', 'web', 'operations']) {
    await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $1) ON CONFLICT DO NOTHING', [c])
  }
  for (const [address, name, status] of [[julien, 'Julien', 'active'], [hugo, 'Hugo', 'active'], [paul, 'Paul', 'active'], [thomas, 'Thomas', 'suspended'], [amina, 'Amina', 'active']]) {
    await db.query('INSERT INTO person.person (address, name) VALUES ($1, $2)', [address, name])
    await db.query(`INSERT INTO membership.member (address, status, since, suspended) VALUES ($1, $2, '2024-01-10', $3)`, [address, status, status === 'suspended' ? '2026-10-01' : null])
  }
  await db.query(
    `INSERT INTO circle.role (id, circle, name) VALUES ('treasurer', 'operations', 'Treasurer'), ('steward', '*', 'Steward'), ('director', 'ag', 'Director')`,
  )
  await db.query(
    `INSERT INTO circle.mandate (grantee, issuer, power, policy, "limit", "from", until, revoked, scope) VALUES
       ('treasurer', 'ag', 'pay-supplier', 'why/1', '3000.00', '2026-01-01', NULL, NULL, NULL),
       ('director', 'ag', 'pay-supplier', 'why/2', '10000.00', '2026-01-01', NULL, NULL, NULL),
       ('steward', 'ag', 'approve-time', 'why/3', NULL, '2026-01-01', NULL, NULL, 'own'),
       ('treasurer', 'ag', 'record-entry', 'why/4', NULL, '2026-01-01', NULL, '2026-09-01', NULL),
       ('treasurer', 'ag', 'close-books', 'why/5', NULL, '2026-01-01', '2026-06-30', NULL, NULL),
       ('treasurer', 'ag', 'issue-invoice', 'why/6', NULL, '2026-12-01', NULL, NULL, NULL)`,
  )
  await db.query(
    `INSERT INTO circle.tenure (circle, holder, role, since, until) VALUES
       ('operations', $1, 'treasurer', NULL, NULL), ('brand', $2, 'steward', NULL, NULL), ('web', $5, 'steward', NULL, NULL),
       ('operations', $3, 'treasurer', NULL, '2026-05-01'), ('operations', $4, 'treasurer', NULL, NULL)`,
    [julien, hugo, paul, thomas, amina],
  )
})

after(async () => {
  await db.end()
})

test('a write the actor may make has no reason', async () => {
  assert.equal(await whyNot(julien, 'pay-supplier', 'ag', 2400_00), null)
  assert.equal(await whyNot(hugo, 'approve-time', 'brand'), null)
})

test('an amount over a mandate\'s limit names the mandate, its limit and who could raise it', async () => {
  const why = await whyNot(julien, 'pay-supplier', 'ag', 3200_00)
  assert.equal(why, `the actor holds no mandate for pay-supplier up to 3200.00 €: mandate ${await id('why/1')} grants it to treasurer in operations up to 3000.00 € a write, issued by ag; a motion of ag raising its limit to 3200.00 €, or a tenure of a role holding it up to that, director in ag (mandate ${await id('why/2')}, issued by ag), would allow it`)
})

test('a mandate whose scope misses the record\'s circle names what it covers and what would', async () => {
  const why = await whyNot(hugo, 'approve-time', 'web')
  const m = await id('why/3')
  assert.ok(why?.startsWith(`the actor holds approve-time by no mandate covering web's records: mandate ${m} grants it to steward in brand over brand's records, issued by ag; a tenure of a role holding it there, `), why ?? '')
  assert.ok(why?.includes(`steward in web (mandate ${m}, issued by ag)`), 'the steward\'s mandate covers its own circle, web here')
  assert.ok(why?.endsWith(', or a motion of ag granting it over web\'s records would allow it'), why ?? '')
})

test('a mandate revoked, expired or yet to apply says since or until when, and that its issuer may grant it anew', async () => {
  assert.match(await whyNot(julien, 'record-entry', 'ag') ?? '', new RegExp(`mandate ${await id('why/4')} grants it to treasurer in operations, revoked on 2026-09-01; a motion of ag granting it anew would allow it$`))
  assert.match(await whyNot(julien, 'close-books', 'ag') ?? '', new RegExp(`mandate ${await id('why/5')} grants it to treasurer in operations, expired on 2026-06-30;`))
  assert.match(await whyNot(julien, 'issue-invoice', 'ag') ?? '', new RegExp(`mandate ${await id('why/6')} grants it to treasurer in operations from 2026-12-01, not yet;`))
})

test('a tenure ended names the mandate it carried and that a new tenure would allow it', async () => {
  assert.equal(await whyNot(paul, 'pay-supplier', 'ag'), `the actor holds no mandate for pay-supplier: mandate ${await id('why/1')} grants it to treasurer in operations, whose tenure ended on 2026-05-01; a tenure of treasurer again would allow it`)
})

test('a suspended member\'s mandate grants to an active member alone', async () => {
  assert.equal(await whyNot(thomas, 'pay-supplier', 'ag', 100_00), `the actor holds no mandate for pay-supplier up to 100.00 €: mandate ${await id('why/1')} grants it to treasurer in operations, on a seat that does not count there: membership has suspended them or let them go; a seat that counts would allow it`)
})

test('no mandate at all names the roles holding the power over the record\'s circle, or the assembly that may grant it', async () => {
  assert.equal(await whyNot(amina, 'pay-supplier', 'ag', 5000_00), `the actor holds no mandate for pay-supplier up to 5000.00 € over ag's records: it is held by director in ag (mandate ${await id('why/2')}, issued by ag), and a tenure of one would allow it`)
  assert.equal(await whyNot(amina, 'repay-capital', 'ag'), 'the actor holds no mandate for repay-capital over ag\'s records: no role holds it, and a motion of ag granting it would allow it')
})

test('no reason names a person', async () => {
  for (const [actor, power, about, cents] of [[julien, 'pay-supplier', 'ag', 3200_00], [hugo, 'approve-time', 'web', null], [paul, 'pay-supplier', 'ag', null], [thomas, 'pay-supplier', 'ag', null], [amina, 'repay-capital', 'ag', null]] as const) {
    const why = await whyNot(actor, power, about, cents)
    assert.ok(why && !why.includes('@') && !/Julien|Hugo|Paul|Thomas|Amina/.test(why), why ?? '')
  }
})
