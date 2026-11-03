// Mandates and rights, alone, on a database holding only the app's core
// and this feat: a mandate is a policy granted to one grantee, a circle or
// a role, whose values this feat holds sound, copies into `circle.mandate`
// as it is adopted and revokes as it ends, and a right one of its own
// kind, copied into `circle.right`; its
// guards refuse a mandate policy adopted without its mandate, and an end
// that leaves it standing. Run by `cella test slice circle`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const pays = (cap: string) => `The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: ${cap}} a write`
const flaw = async (marked: object) => (await db.query<{ r: string | null }>('SELECT circle.mandate_flaw($1) AS r', [marked])).rows[0].r
const guard = async (fn: string, policy: string) => (await db.query<{ r: string | null }>(`SELECT circle.${fn}($1) AS r`, [{ policy }])).rows[0].r
const adopt = async (kind: string, wording: string, motion: string, n: number, replaces: string | null = null) =>
  (
    await db.query<{ id: string }>(`SELECT policy.adopt('ag', $1, $2, NULL, $3, $4, cella.verdict_date(), NULL, $5) AS id`, [
      kind,
      wording,
      motion,
      n,
      replaces,
    ])
  ).rows[0].id
const mandate = async (policy: string) =>
  (
    await db.query<{ grantee: string; power: string; limit: number; from: string; revoked: string | null }>(
      `SELECT grantee, power, cella.cents("limit")::int AS "limit", to_char("from", 'YYYY-MM-DD') AS "from", to_char(revoked, 'YYYY-MM-DD') AS revoked
       FROM circle.mandate WHERE policy = $1`,
      [policy],
    )
  ).rows[0]

// Each test stages its circles and roles in its own transaction, beside
// the tree test's on the same database, and rolls them back.
const staged = async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, parent) VALUES ('ag', 'Assemblée', NULL) ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.circle (id, name, parent) VALUES ('operations', 'Operations', 'ag') ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('finance', 'operations', 'Finance'), ('lead', '*', 'Circle lead') ON CONFLICT DO NOTHING`)
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-21'`)
})

after(async () => {
  await db.end()
})

test('a mandate marks one grantee, a role or a circle, a power in lower case and at most one cap, an amount', async () => {
  await staged()
  try {
    assert.equal(await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €' }), null)
    assert.equal(await flaw({ role: 'lead', power: 'approve-expense', budget: '1 000 €', per: 'month' }), null)
    assert.match((await flaw({ power: 'pay-supplier' })) ?? '', /names its grantee/)
    assert.match((await flaw({ role: 'printer', power: 'pay-supplier' })) ?? '', /no role printer/)
    assert.match((await flaw({ role: 'finance', power: 'Pay suppliers' })) ?? '', /power in lower case/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €', budget: '1 000 €', per: 'month' })) ?? '', /not both/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: 'three thousand' })) ?? '', /a limit is an amount/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', budget: '1 000 €' })) ?? '', /per month or per year/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', rate: '20 %' })) ?? '', /not rate/)
    // A collective mandate marks a circle instead: one grantee, whose kind
    // is the one it is marked as.
    assert.equal(await flaw({ circle: 'operations', power: 'admit-member' }), null)
    assert.match((await flaw({ power: 'admit-member' })) ?? '', /names its grantee, a role, as {role: finance}, or a circle, as {circle: ag}/)
    assert.match((await flaw({ role: 'finance', circle: 'operations', power: 'admit-member' })) ?? '', /one grantee, a role or a circle/)
    assert.match((await flaw({ circle: 'web', power: 'admit-member' })) ?? '', /no circle web/)
    assert.match((await flaw({ role: 'operations', power: 'admit-member' })) ?? '', /no role operations/)
    assert.match((await flaw({ circle: 'finance', power: 'admit-member' })) ?? '', /no circle finance/)
    // A person never holds a mandate, and a right is none.
    assert.match((await flaw({ person: 'julien@lanterne.coop', power: 'pay-supplier' })) ?? '', /a person holds no mandate/)
    assert.match((await flaw({ right: 'employee', power: 'claim-expense' })) ?? '', /a right is no mandate/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('adopting a mandate policy copies its values into its mandate, and one replacing it revokes it the day it applies', async () => {
  await staged()
  try {
    const first = await adopt('mandate', pays('3 000 €'), 'm-2026-020', 1)
    assert.match((await guard('grants', first)) ?? '', /m-2026-020\/1 grants no mandate: its values are copied as it is adopted/)
    await db.query('SELECT circle.mandate_from($1)', [first])
    assert.equal(await guard('grants', first), null)
    assert.deepEqual(await mandate(first), { grantee: 'finance', power: 'pay-supplier', limit: 300000, from: '2026-11-21', revoked: null })

    const second = await adopt('mandate', pays('4 000 €'), 'm-2026-020', 2, first)
    await db.query('SELECT circle.mandate_from($1)', [second])
    assert.equal(await guard('grants', second), null)
    assert.equal((await mandate(second)).limit, 400000)
    assert.equal((await mandate(first)).revoked, '2026-11-21')

    // A rule grants no mandate.
    const rule = await adopt('rule', 'Refused clients are named in the internal rules', 'm-2026-020', 3)
    assert.equal(await db.query('SELECT mandate AS m FROM circle.mandate_from($1)', [rule]).then((r) => r.rows[0].m), null)
    assert.equal(await guard('grants', rule), null)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('ending a mandate policy revokes its mandate on the day it ends', async () => {
  await staged()
  try {
    const policy = await adopt('mandate', pays('3 000 €'), 'm-2026-020', 1)
    await db.query('SELECT circle.mandate_from($1)', [policy])
    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    assert.match((await guard('revokes', policy)) ?? '', /is not revoked the day it ends/)
    await db.query('SELECT circle.mandate_ended($1)', [policy])
    assert.equal(await guard('revokes', policy), null)
    assert.equal((await mandate(policy)).revoked, '2026-11-21')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy whose values grant no mandate is refused as it is copied', async () => {
  await staged()
  try {
    const policy = await adopt('mandate', 'The {role: printer} role holds {power: pay-supplier}', 'm-2026-020', 1)
    await db.query('SAVEPOINT copy')
    await assert.rejects(db.query('SELECT circle.mandate_from($1)', [policy]), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, /no role printer/)
      return true
    })
    await db.query('ROLLBACK TO SAVEPOINT copy')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a collective mandate is on a circle, and the circle holds it itself, not the circle above nor any role', async () => {
  await staged()
  try {
    const holds = async (circle: string, power: string) =>
      (await db.query<{ h: boolean }>(`SELECT circle.holds($1, $2, cella.verdict_date()) AS h`, [circle, power])).rows[0].h
    assert.equal(await holds('operations', 'admit-member'), false)
    const policy = await adopt('mandate', 'The {circle: operations} circle holds {power: admit-member}, to admit members, by motion', 'm-2026-020', 1)
    await db.query('SELECT circle.mandate_from($1)', [policy])
    assert.equal(await guard('grants', policy), null)
    assert.deepEqual(
      (await db.query(`SELECT m.grantee, g.kind, m.power FROM circle.mandate m JOIN circle.grantee g ON g.id = m.grantee WHERE m.policy = $1`, [policy])).rows,
      [{ grantee: 'operations', kind: 'circle', power: 'admit-member' }],
    )
    assert.equal(await holds('operations', 'admit-member'), true)
    assert.equal(await holds('ag', 'admit-member'), false)
    assert.equal(await holds('operations', 'suspend-member'), false)
    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    await db.query('SELECT circle.mandate_ended($1)', [policy])
    assert.equal(await holds('operations', 'admit-member'), false)
    // A grantee is a circle or a role, never a person.
    await db.query('SAVEPOINT holder')
    await assert.rejects(
      db.query(`INSERT INTO circle.mandate (grantee, issuer, power, policy, "from") VALUES ('julien@lanterne.coop', 'ag', 'admit-member', 'm-2026-022/1', '2026-01-01')`),
      /mandate_grantee_fkey/,
    )
    await db.query('ROLLBACK TO SAVEPOINT holder')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('every circle and every role is a grantee, and a circle and a role never share an id', async () => {
  await staged()
  try {
    assert.deepEqual(
      (await db.query(`SELECT id, kind FROM circle.grantee WHERE id IN ('ag', 'operations', 'finance', 'lead', 'participant') ORDER BY id`)).rows,
      [
        { id: 'ag', kind: 'circle' },
        { id: 'finance', kind: 'role' },
        { id: 'lead', kind: 'role' },
        { id: 'operations', kind: 'circle' },
        { id: 'participant', kind: 'role' },
      ],
    )
    await db.query('SAVEPOINT shared')
    await assert.rejects(db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('operations', 'operations', 'Operator')`), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, /operations is a circle already: a circle and a role never share an id/)
      return true
    })
    await db.query('ROLLBACK TO SAVEPOINT shared')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a right is a policy of its own kind, copied into circle.right with no grantee, and ending it revokes it', async () => {
  await staged()
  try {
    const right = async (marked: object) => (await db.query<{ r: string | null }>('SELECT circle.right_flaw($1) AS r', [marked])).rows[0].r
    assert.equal(await right({ right: 'employee', power: 'claim-expense' }), null)
    assert.match((await right({ power: 'claim-expense' })) ?? '', /names who it is given to/)
    assert.match((await right({ right: 'visitor', power: 'keep-profile' })) ?? '', /every person, member or employee, as {right: member}, not visitor/)
    assert.match((await right({ right: 'member', role: 'finance', power: 'draw-account' })) ?? '', /not role/)

    const policy = await adopt('right', 'Every {right: employee} holds {power: log-time}, to log, correct and submit their own time', 'm-2026-020', 1)
    assert.match((await guard('grants', policy)) ?? '', /gives no right: its values are copied as it is adopted/)
    assert.equal(await db.query('SELECT mandate AS m FROM circle.mandate_from($1)', [policy]).then((r) => r.rows[0].m), null, 'a right is no mandate')
    assert.equal(await guard('grants', policy), null)
    assert.deepEqual(
      (await db.query(`SELECT "right", power, to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.right WHERE policy = $1`, [policy])).rows,
      [{ right: 'employee', power: 'log-time', revoked: null }],
    )
    assert.equal((await db.query('SELECT count(*)::int AS n FROM circle.mandate WHERE policy = $1', [policy])).rows[0].n, 0)

    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    assert.match((await guard('revokes', policy)) ?? '', /right \d+ of m-2026-020\/1 is not revoked the day it ends/)
    await db.query('SELECT circle.mandate_ended($1)', [policy])
    assert.equal(await guard('revokes', policy), null)
  } finally {
    await db.query('ROLLBACK')
  }
})
