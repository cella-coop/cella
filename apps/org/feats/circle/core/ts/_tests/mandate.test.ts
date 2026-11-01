// Mandates, alone, on a database holding only the app's core and this
// feat: a mandate is a policy, whose values this feat holds sound, copies
// into `circle.mandate` as it is adopted and revokes as it ends; its
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
    await db.query<{ role: string; power: string; limit: number; from: string; revoked: string | null }>(
      `SELECT role, power, cella.cents("limit")::int AS "limit", to_char("from", 'YYYY-MM-DD') AS "from", to_char(revoked, 'YYYY-MM-DD') AS revoked
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

test('a mandate marks a role, a power in lower case and at most one cap, an amount', async () => {
  await staged()
  try {
    assert.equal(await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €' }), null)
    assert.equal(await flaw({ role: 'lead', power: 'approve-expense', budget: '1 000 €', per: 'month' }), null)
    assert.match((await flaw({ power: 'pay-supplier' })) ?? '', /names its role/)
    assert.match((await flaw({ role: 'printer', power: 'pay-supplier' })) ?? '', /no role printer/)
    assert.match((await flaw({ role: 'finance', power: 'Pay suppliers' })) ?? '', /power in lower case/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €', budget: '1 000 €', per: 'month' })) ?? '', /not both/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: 'three thousand' })) ?? '', /a limit is an amount/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', budget: '1 000 €' })) ?? '', /per month or per year/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', rate: '20 %' })) ?? '', /not rate/)
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
    assert.deepEqual(await mandate(first), { role: 'finance', power: 'pay-supplier', limit: 300000, from: '2026-11-21', revoked: null })

    const second = await adopt('mandate', pays('4 000 €'), 'm-2026-020', 2, first)
    await db.query('SELECT circle.mandate_from($1)', [second])
    assert.equal(await guard('grants', second), null)
    assert.equal((await mandate(second)).limit, 400000)
    assert.equal((await mandate(first)).revoked, '2026-11-21')

    // A rule grants no mandate.
    const rule = await adopt('rule', 'Refused clients are named in the internal rules', 'm-2026-020', 3)
    assert.equal(await db.query('SELECT circle.mandate_from($1) AS m', [rule]).then((r) => r.rows[0].m), null)
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
