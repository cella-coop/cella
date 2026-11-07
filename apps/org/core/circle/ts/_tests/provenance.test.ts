// A mandate's page as its driver reads it, alone, on a database holding
// only the app's core and this feat: a mandate three deep reads its
// chain from the root the assembly issued, which has no parent, down to
// itself; the root reads what was issued under it, by depth; each where
// it stands on the verdict date; and an id no mandate has reads none.
// Run by `cella test slice circle`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { mandate } from '../src/api/index.ts'

const db = new pg.Client()

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
})

after(async () => {
  await db.end()
})

test('a mandate three deep reads its chain from the assembly\'s root down to itself, and the root what was issued under it', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assemblée', true) ON CONFLICT DO NOTHING`)
    for (const [id, name] of [['coordination', 'Coordination'], ['operations', 'Operations'], ['brand', 'Brand']]) {
      await db.query('INSERT INTO circle.circle (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, name])
    }
    await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('lineage-buyer', 'brand', 'Print buyer')`)
    const grant = async (grantee: string, issuer: string, parent: string | null, policy: string, limit: string, scope: string | null, revoked: string | null = null) =>
      (await db.query<{ id: string }>(
        `INSERT INTO circle.mandate (grantee, issuer, parent, power, policy, "from", "limit", scope, revoked)
         VALUES ($1, $2, $3, 'approve-bill', $4, '2026-01-01', $5, $6, $7) RETURNING id::text`,
        [grantee, issuer, parent, policy, limit, scope, revoked],
      )).rows[0].id
    const root = await grant('coordination', 'ag', null, 'm-2099-901/1', '3000', null)
    const mid = await grant('operations', 'coordination', root, 'm-2099-902/1', '2000', null)
    const deep = await grant('lineage-buyer', 'operations', mid, 'm-2099-903/1', '1200', 'brand')
    const gone = await grant('brand', 'operations', mid, 'm-2099-904/1', '500', 'brand', '2026-10-01')

    const read = await mandate(db, deep)
    assert.ok(read)
    assert.deepEqual(
      read.chain.map((k) => [k.id, k.depth, k.grantee, k.issuer, k.parent, k.limit, k.scope]),
      [
        [root, 0, 'coordination', 'ag', null, 300000, null],
        [mid, 1, 'operations', 'coordination', root, 200000, null],
        [deep, 2, 'lineage-buyer', 'operations', mid, 120000, 'brand'],
      ],
    )
    assert.deepEqual([read.granteeName, read.circle, read.state, read.since], ['Print buyer', 'brand', 'stands', '2026-01-01'])
    assert.deepEqual(read.under, [])

    const top = await mandate(db, root)
    assert.ok(top)
    assert.deepEqual(top.chain.map((k) => k.id), [root])
    assert.deepEqual(
      top.under.map((k) => [k.id, k.depth, k.state, k.since]),
      [[mid, 1, 'stands', '2026-01-01'], [deep, 2, 'stands', '2026-01-01'], [gone, 2, 'revoked', '2026-10-01']],
    )
    assert.equal(await mandate(db, '999999'), null)
    assert.equal(await mandate(db, 'not-a-mandate'), null)
  } finally {
    await db.query('ROLLBACK')
  }
})
