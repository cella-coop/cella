// What a motion decides, alone, on a database holding only the app's
// core and this feat: an action is of a registered kind, fixed with the
// proposal, and `motion.proposes` checks the write proposed what its
// payload names. Run by `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const refused = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

const proposes = async (payload: object) => (await db.query<{ r: string | null }>('SELECT motion.proposes($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO motion.carries (kind, label, owner) VALUES ('admit', 'Admit a member', 'test')`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES
       ('m-2026-012', 'ag', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('m-2026-013', 'ag', 'Admit someone', 'consent', 'consent', '2026-10-24', '2026-11-07')`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated, and no kind is registered but the test\'s', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'membership_motion', 'circle_membership_motion')`)
  assert.deepEqual(rows, [])
  assert.deepEqual((await db.query('SELECT kind FROM motion.carries')).rows, [{ kind: 'admit' }])
})

test('an action is of a registered kind', async () => {
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO motion.action (motion, n, kind) VALUES ('m-2026-013', 1, 'crown')`), /action_kind_fkey/)
  await db.query('ROLLBACK')
})

test('an action is fixed with the proposal: none is added once a stance is given', async () => {
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-012', 1, 'admit', '{"member": "ines@lanterne.example", "shares": 20}')`)
  await db.query(`INSERT INTO motion.vote (receipt, motion, member, stance, at) VALUES (1, 'm-2026-012', 'yusuf@lanterne.example', 'consent', '2026-10-15')`)
  await refused(
    `INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-012', 2, 'admit', '{"member": "mallory@lanterne.example"}')`,
    [],
    /m-2026-012 has stances or is closed: what it decides is fixed/,
  )
})

test('motion.proposes refuses a proposal this write did not make, or one deciding otherwise than its payload', async () => {
  assert.match((await proposes({ motion: 'm-2026-012', actions: [{}] })) ?? '', /m-2026-012 was not proposed by this write/)
  assert.equal(await proposes({ motion: 'nowhere' }), 'no motion nowhere')
})
