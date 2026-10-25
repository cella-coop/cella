// What a decision decides, alone, on a database holding only the app's
// core and this feat: a motion is of a registered kind, fixed with the
// proposal, and `decision.proposes` checks the write proposed what its
// payload names. Run by `cella test slice decision`.

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

const proposes = async (payload: object) => (await db.query<{ r: string | null }>('SELECT decision.proposes($1) AS r', [payload])).rows[0].r

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO decision.kind (kind, label, owner) VALUES ('admit', 'Admit a member', 'test')`)
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline) VALUES
       ('d-2026-012', 'ag', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('d-2026-013', 'ag', 'Admit someone', 'consent', 'consent', '2026-10-24', '2026-11-07')`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated, and no kind is registered but the test\'s', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'decision_membership', 'circle_decision_membership')`)
  assert.deepEqual(rows, [])
  assert.deepEqual((await db.query('SELECT kind FROM decision.kind')).rows, [{ kind: 'admit' }])
})

test('a motion is of a registered kind', async () => {
  await db.query('BEGIN')
  await assert.rejects(db.query(`INSERT INTO decision.motion (decision, n, kind) VALUES ('d-2026-013', 1, 'crown')`), /motion_kind_fkey/)
  await db.query('ROLLBACK')
})

test('a motion is fixed with the proposal: none is added once a stance is given', async () => {
  await db.query(`INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-2026-012', 1, 'admit', '{"member": "ines@lanterne.example", "shares": 20}')`)
  await db.query(`INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES (1, 'd-2026-012', 'yusuf@lanterne.example', 'consent', '2026-10-15')`)
  await refused(
    `INSERT INTO decision.motion (decision, n, kind, args) VALUES ('d-2026-012', 2, 'admit', '{"member": "mallory@lanterne.example"}')`,
    [],
    /d-2026-012 has stances or is closed: what it decides is fixed/,
  )
})

test('decision.proposes refuses a proposal this write did not make, or one deciding otherwise than its payload', async () => {
  assert.match((await proposes({ decision: 'd-2026-012', motions: [{}] })) ?? '', /d-2026-012 was not proposed by this write/)
  assert.equal(await proposes({ decision: 'nowhere' }), 'no decision nowhere')
})
