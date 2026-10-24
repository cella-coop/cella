// The circles' tree, alone, on a database holding only the app's core and
// this feat: each circle's path follows its parent's, a nesting that makes
// a cycle is refused, a moved circle carries its subtree, `circle.nests`
// refuses a cycle a nesting settled first made, and a mandate keeps its
// grant. Run by `cella test slice circle`.

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
const rule = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT circle.${fn}($1) AS r`, [payload])).rows[0].r

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
  assert.equal(await rule('nests', { circle: 'print', parent: 'brand' }), null)
  assert.match((await rule('nests', { circle: 'print', parent: 'marketing' })) ?? '', /print was not nested under marketing by this write/)
  // As a concurrent nesting leaves it: brand under print committed, while
  // this write's view of brand's path was from before.
  await db.query('BEGIN')
  await db.query('ALTER TABLE circle.circle DISABLE TRIGGER placed')
  await db.query(`UPDATE circle.circle SET parent = 'print', path = '{ag,coordination,brand,print,brand}' WHERE id = 'brand'`)
  assert.match((await rule('nests', { circle: 'print', parent: 'brand' })) ?? '', /brand is within print: nesting it there makes a cycle/)
  await db.query('ROLLBACK')
})

test('a mandate keeps its grant, and a revoked one stays revoked', async () => {
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('lead', '*', 'Circle lead')`)
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO circle.mandate (role, power, text, "from", revoked) VALUES ('lead', 'approve-time', 'approve timesheets', '2026-01-01', '2026-10-01') RETURNING id`,
  )
  await refused(`UPDATE circle.mandate SET revoked = NULL WHERE id = ${rows[0].id}`, /keeps its grant, and stays revoked/)
  await refused(`UPDATE circle.mandate SET power = 'commit' WHERE id = ${rows[0].id}`, /keeps its grant/)
  assert.match((await rule('revokes', { mandate: Number(rows[0].id) })) ?? '', /was not revoked by this write/)
})
