// The circles and the mandates' provenance, alone, on a database holding
// only the app's core and this feat: circles never nest and one only is
// the assembly, and a mandate keeps its grant and is a root the assembly
// issued or issued under a parent its issuer holds, narrower than it in
// cap, scope and term, and revoking one revokes every mandate issued
// under it. Run by `cella test slice circle`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const refused = async (sql: string, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  for (const id of ['coordination', 'brand', 'marketing']) {
    await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $1)', [id])
  }
})

after(async () => {
  await db.end()
})

test('circles never nest, and one circle only is the assembly', async () => {
  assert.equal((await db.query<{ a: string }>('SELECT circle.assembly() AS a')).rows[0].a, 'ag')
  await assert.rejects(db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('rival', 'A second assembly', true)`), /one_assembly/)
  const columns = await db.query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'circle' AND table_name = 'circle' ORDER BY ordinal_position`,
  )
  assert.deepEqual(columns.rows.map((r) => r.c), ['id', 'name', 'assembly', 'purpose', 'procedure'])
  assert.equal((await db.query(`SELECT FROM cella.guard WHERE op LIKE 'circle:circle:%'`)).rowCount, 0)
})

test('a mandate keeps its grant, and a revoked one stays revoked, from its day or an earlier one', async () => {
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead')`)
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO circle.mandate (grantee, issuer, power, policy, "from", revoked) VALUES ('lead', 'ag', 'approve-time', 'm-2026-001/1', '2026-01-01', '2026-10-01') RETURNING id`,
  )
  await refused(`UPDATE circle.mandate SET revoked = NULL WHERE id = ${rows[0].id}`, /keeps its grant, and stays revoked/)
  await refused(`UPDATE circle.mandate SET revoked = '2026-11-01' WHERE id = ${rows[0].id}`, /keeps its grant, and stays revoked/)
  // A revocation down the tree may bring its day earlier, never later.
  await db.query(`UPDATE circle.mandate SET revoked = '2026-09-01' WHERE id = ${rows[0].id}`)
  await refused(`UPDATE circle.mandate SET power = 'commit' WHERE id = ${rows[0].id}`, /keeps its grant/)
})

test('a mandate the assembly issues is a root; one another circle issues stands under a parent its issuer holds, narrower than it', async () => {
  const overreach = async () => (await db.query<{ r: string | null }>(`SELECT circle.overreach('2026-10-24') AS r`)).rows[0].r
  const outlives = async (id: string) => (await db.query<{ r: string | null }>(`SELECT circle.outlives($1, '2026-10-24') AS r`, [id])).rows[0].r
  // A mandate from 1 January 2026, its cap and term as `cap` says.
  const grant = async (
    grantee: string,
    issuer: string,
    parent: string | null,
    power: string,
    n: number,
    cap: { limit?: string; budget?: string; per?: string; until?: string; scope?: string } = {},
  ) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "from", "limit", budget, per, until, scope)
         VALUES ($1, $2, $3, $4, $5, '2026-01-01', $6, $7, $8, $9, $10) RETURNING id`,
        [grantee, issuer, parent, power, `m-2026-002/${n}`, cap.limit ?? null, cap.budget ?? null, cap.per ?? null, cap.until ?? null, cap.scope ?? null],
      )
    ).rows[0].id
  const revoke = (id: string) => db.query(`UPDATE circle.mandate SET revoked = '2026-10-24' WHERE id = $1`, [id])
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('steward', 'coordination', 'Steward'), ('maker', 'brand', 'Maker')`)
    // The assembly issues coordination pay-supplier up to 5 000 €: a root.
    const root = await grant('coordination', 'ag', null, 'pay-supplier', 1, { limit: '5000' })
    assert.equal(await overreach(), null)
    // Coordination issues Brand's maker 3 000 € under it.
    const maker = await grant('maker', 'coordination', root, 'pay-supplier', 2, { limit: '3000' })
    assert.equal(await overreach(), null)
    // Coordination holds no approve-expense, so it issues none.
    const astray = await grant('maker', 'coordination', null, 'approve-expense', 3)
    assert.match((await overreach()) ?? '', new RegExp(`mandate ${astray} grants approve-expense to maker, issued by coordination, which holds no mandate for approve-expense to issue it under`))
    await revoke(astray)
    // Wider than its parent's cap: 9 000 € a write under 5 000 €.
    const wide = await grant('steward', 'coordination', root, 'pay-supplier', 4, { limit: '9000' })
    assert.match(
      (await overreach()) ?? '',
      new RegExp(`mandate ${wide} grants pay-supplier to steward, issued by coordination, is wider than mandate ${root} it is issued under: its cap, up to 9000.00 € a write, is wider than its parent's, up to 5000.00 € a write`),
    )
    await revoke(wide)
    // A budget is narrower only than a budget over the same period.
    const monthly = await grant('coordination', 'ag', null, 'approve-expense', 5, { budget: '1000', per: 'month' })
    const yearly = await grant('maker', 'coordination', monthly, 'approve-expense', 6, { budget: '500', per: 'year' })
    assert.match((await overreach()) ?? '', /its cap, within 500\.00 € a year, is wider than its parent's, within 1000\.00 € a month/)
    await revoke(yearly)
    // No longer a term: until no later than the parent's, from no earlier.
    const term = await grant('coordination', 'ag', null, 'approve-bill', 7, { until: '2026-12-31' })
    const outlasts = await grant('maker', 'coordination', term, 'approve-bill', 8)
    assert.match((await overreach()) ?? '', /it outlasts its parent, which ends on 2026-12-31/)
    await revoke(outlasts)
    const early = (
      await db.query<{ id: string }>(
        `INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "from", until) VALUES ('maker', 'coordination', $1, 'approve-bill', 'm-2026-002/9', '2025-06-01', '2026-12-01') RETURNING id`,
        [term],
      )
    ).rows[0].id
    assert.match((await overreach()) ?? '', /it applies from 2025-06-01, before its parent, from 2026-01-01/)
    await revoke(early)
    // A parent is one its issuer holds.
    const borrowed = await grant('maker', 'brand', root, 'pay-supplier', 10, { limit: '1000' })
    assert.match((await overreach()) ?? '', new RegExp(`mandate ${borrowed} grants pay-supplier to maker, issued by brand, under mandate ${root}, which is coordination's`))
    await revoke(borrowed)
    // No wider a scope: under one on Brand's resources, Brand's alone, so
    // the whole co-op's or another circle's is wider.
    const branded = await grant('coordination', 'ag', null, 'manage-project', 12, { scope: 'brand' })
    const whole = await grant('maker', 'coordination', branded, 'manage-project', 13)
    assert.match((await overreach()) ?? '', new RegExp(`mandate ${whole} .* it covers the whole co-op, wider than its parent, which covers brand alone`))
    await revoke(whole)
    const elsewhere = await grant('maker', 'coordination', branded, 'manage-project', 14, { scope: 'marketing' })
    assert.match((await overreach()) ?? '', /it covers marketing, wider than its parent, which covers brand alone/)
    await revoke(elsewhere)
    await grant('maker', 'coordination', branded, 'manage-project', 15, { scope: 'brand' })
    assert.equal(await overreach(), null)
    // A parent revoked alone leaves a mandate standing under it, which is
    // refused; `circle.revoke` revokes it on the same day with every
    // mandate issued under it, down the tree, and says each.
    const deep = await grant('steward', 'maker', maker, 'pay-supplier', 11, { limit: '1000' })
    assert.equal(await overreach(), null)
    await db.query('SAVEPOINT alone')
    await revoke(root)
    assert.match((await overreach()) ?? '', new RegExp(`mandate ${maker} grants pay-supplier to maker, issued by coordination, under mandate ${root}, revoked on 2026-10-24, which revokes every mandate issued under it`))
    assert.equal(await outlives(root), `mandate ${maker}, issued under mandate ${root}, is not revoked with it on 2026-10-24`)
    await db.query('ROLLBACK TO SAVEPOINT alone')
    const { rows } = await db.query<{ gone: string[] }>(`SELECT circle.revoke($1, '2026-10-24') AS gone`, [root])
    assert.deepEqual(rows[0].gone, [root, maker, deep])
    assert.equal(await overreach(), null)
    assert.equal(await outlives(root), null)
    assert.deepEqual((await db.query<{ gone: string[] }>(`SELECT circle.revoke($1, '2026-10-24') AS gone`, [root])).rows[0].gone, [], 'none is revoked twice')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a mandate\'s chain reads from its root, the assembly\'s, down to itself', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('maker', 'brand', 'Maker')`)
    const { rows: up } = await db.query<{ id: string }>(
      `INSERT INTO circle.mandate (grantee, issuer, power, policy, "from", "limit") VALUES ('coordination', 'ag', 'set-budget', 'm-2026-003/1', '2026-01-01', '10000') RETURNING id`,
    )
    const { rows: down } = await db.query<{ id: string }>(
      `INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "from", "limit") VALUES ('maker', 'coordination', $1, 'set-budget', 'm-2026-003/2', '2026-01-01', '8000') RETURNING id`,
      [up[0].id],
    )
    const { rows } = await db.query(`SELECT id::text, grantee, issuer, depth FROM circle.chain($1)`, [down[0].id])
    assert.deepEqual(rows, [
      { id: up[0].id, grantee: 'coordination', issuer: 'ag', depth: 0 },
      { id: down[0].id, grantee: 'maker', issuer: 'coordination', depth: 1 },
    ])
    await refused(`UPDATE circle.mandate SET parent = NULL WHERE id = ${down[0].id}`, /keeps its grant/)
  } finally {
    await db.query('ROLLBACK')
  }
})
