// The circles' tree, alone, on a database holding only the app's core and
// this feat: each circle's path follows its parent's, a nesting that makes
// a cycle is refused, a moved circle carries its subtree, `circle.nests`
// refuses a cycle a nesting settled first made, and a mandate keeps its
// grant and is carved from what the circle above holds. Run by `cella
// test slice circle`.

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

const path = async (id: string) => (await db.query<{ path: string[] }>('SELECT path FROM circle.circle WHERE id = $1', [id])).rows[0].path
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT circle.${fn}($1) AS r`, [payload])).rows[0].r

before(async () => {
  await db.connect()
  for (const [id, parent] of [
    ['ag', null],
    ['coordination', 'ag'],
    ['brand', 'coordination'],
    ['marketing', 'coordination'],
    ['print', 'brand'],
  ]) {
    await db.query('INSERT INTO circle.circle (id, name, parent) VALUES ($1, $1, $2)', [id, parent])
  }
})

after(async () => {
  await db.end()
})

test('a circle\'s path runs from the assembly down to itself, and the tree has one root', async () => {
  assert.deepEqual(await path('print'), ['ag', 'coordination', 'brand', 'print'])
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO circle.circle (id, name) VALUES ('rival', 'A second assembly')`), /one_root/)
  await db.query('ROLLBACK')
})

test('nesting a circle within itself is refused, whatever writes it', async () => {
  await refused(`UPDATE circle.circle SET parent = 'print' WHERE id = 'brand'`, /print is within brand: nesting it there makes a cycle/)
  await refused(`UPDATE circle.circle SET parent = 'brand' WHERE id = 'brand'`, /brand is within brand/)
})

test('a moved circle carries its subtree', async () => {
  await db.query('BEGIN')
  await db.query(`UPDATE circle.circle SET parent = 'marketing' WHERE id = 'brand'`)
  assert.deepEqual(await path('print'), ['ag', 'coordination', 'marketing', 'brand', 'print'])
  assert.equal((await db.query(`SELECT circle.within('print', 'marketing') AS w`)).rows[0].w, true)
  assert.equal((await db.query(`SELECT circle.within('marketing', 'brand') AS w`)).rows[0].w, false)
  await db.query('ROLLBACK')
})

test('circle.nests refuses a nesting whose parent moved within the circle meanwhile', async () => {
  assert.equal(await guard('nests', { circle: 'print', parent: 'brand' }), null)
  assert.match((await guard('nests', { circle: 'print', parent: 'marketing' })) ?? '', /print was not nested under marketing by this write/)
  // As a concurrent nesting leaves it: brand under print committed, while
  // this write's view of brand's path was from before.
  await db.query('BEGIN')
  await db.query('ALTER TABLE circle.circle DISABLE TRIGGER placed')
  await db.query(`UPDATE circle.circle SET parent = 'print', path = '{ag,coordination,brand,print,brand}' WHERE id = 'brand'`)
  assert.match((await guard('nests', { circle: 'print', parent: 'brand' })) ?? '', /brand is within print: nesting it there makes a cycle/)
  await db.query('ROLLBACK')
})

test('a mandate keeps its grant, and a revoked one stays revoked', async () => {
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead')`)
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO circle.mandate (role, power, policy, "from", revoked) VALUES ('lead', 'approve-time', 'm-2026-001/1', '2026-01-01', '2026-10-01') RETURNING id`,
  )
  await refused(`UPDATE circle.mandate SET revoked = NULL WHERE id = ${rows[0].id}`, /keeps its grant, and stays revoked/)
  await refused(`UPDATE circle.mandate SET power = 'commit' WHERE id = ${rows[0].id}`, /keeps its grant/)
})

test('a mandate is carved from what the circle above holds, and a moved subtree takes its new circles\' limits', async () => {
  const beyond = async () => (await db.query<{ r: string | null }>(`SELECT circle.beyond('2026-10-24') AS r`)).rows[0].r
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('steward', 'coordination', 'Steward'), ('maker', 'brand', 'Maker'), ('printer', 'print', 'Printer'), ('seller', 'marketing', 'Seller')`)
    // No circle above holds pay-supplier: the assembly's, uncapped.
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", "limit") VALUES ('printer', 'pay-supplier', 'm-2026-002/1', '2026-01-01', '9000')`)
    assert.equal(await beyond(), null)
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", "limit") VALUES ('steward', 'pay-supplier', 'm-2026-002/2', '2026-01-01', '5000'), ('maker', 'pay-supplier', 'm-2026-002/3', '2026-01-01', '3000')`)
    // print's nearest holder is brand, at 3 000 €; brand's is coordination, at 5 000 €.
    assert.match((await beyond()) ?? '', /grants pay-supplier to printer beyond what brand holds of it/)
    await db.query(`UPDATE circle.mandate SET revoked = '2026-10-24' WHERE role = 'printer'`)
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", "limit") VALUES ('printer', 'pay-supplier', 'm-2026-002/4', '2026-01-01', '2000')`)
    assert.equal(await beyond(), null)
    // A budget is carved from a budget over the same period.
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", budget, per) VALUES ('steward', 'approve-expense', 'm-2026-002/5', '2026-01-01', '1000', 'month'), ('maker', 'approve-expense', 'm-2026-002/6', '2026-01-01', '500', 'year')`)
    assert.match((await beyond()) ?? '', /grants approve-expense to maker beyond what coordination holds of it/)
    await db.query(`UPDATE circle.mandate SET revoked = '2026-10-24' WHERE role = 'maker' AND power = 'approve-expense'`)
    // Moved under marketing, whose seller holds pay-supplier at 1 000 €, print's 2 000 € is beyond it.
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", "limit") VALUES ('seller', 'pay-supplier', 'm-2026-002/7', '2026-01-01', '1000')`)
    await db.query(`UPDATE circle.circle SET parent = 'marketing' WHERE id = 'print'`)
    assert.match((await beyond()) ?? '', /grants pay-supplier to printer beyond what marketing holds of it/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a collective mandate is carved as a role\'s is, and caps the mandates below as a role\'s does', async () => {
  const beyond = async () => (await db.query<{ r: string | null }>(`SELECT circle.beyond('2026-10-24') AS r`)).rows[0].r
  await db.query('BEGIN')
  try {
    await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('maker', 'brand', 'Maker')`)
    // Coordination holds set-budget as a whole, up to 10 000 €.
    await db.query(`INSERT INTO circle.mandate (circle, power, policy, "from", "limit") VALUES ('coordination', 'set-budget', 'm-2026-003/1', '2026-01-01', '10000')`)
    assert.equal(await beyond(), null)
    // Brand, below it, as a whole at 20 000 €: beyond what coordination holds.
    await db.query(`INSERT INTO circle.mandate (circle, power, policy, "from", "limit") VALUES ('brand', 'set-budget', 'm-2026-003/2', '2026-01-01', '20000')`)
    assert.match((await beyond()) ?? '', /grants set-budget to brand beyond what coordination holds of it/)
    await db.query(`UPDATE circle.mandate SET revoked = '2026-10-24' WHERE policy = 'm-2026-003/2'`)
    // A role of brand's is carved from coordination's collective mandate too.
    await db.query(`INSERT INTO circle.mandate (role, power, policy, "from", "limit") VALUES ('maker', 'set-budget', 'm-2026-003/3', '2026-01-01', '12000')`)
    assert.match((await beyond()) ?? '', /grants set-budget to maker beyond what coordination holds of it/)
  } finally {
    await db.query('ROLLBACK')
  }
})
