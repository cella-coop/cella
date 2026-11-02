// What a motion decides, alone, on a database holding only the app's
// core and this feat: a kind and an action that cites a motion are
// registered through the feat's register functions, an action is of a
// registered kind, fixed with the proposal, and `motion.proposes` checks
// the write proposed what its payload names. Run by `cella test slice motion`.

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
  await db.query(`SELECT motion.register_carries('admit', 'Admit a member', '[{"name": "member", "label": "Address", "type": "text"}]', 'test')`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES
       ('m-2026-012', 'ag', 'Admit Inès', 'consent', 'consent', '2026-10-14', '2026-10-31'),
       ('m-2026-013', 'ag', 'Admit someone', 'consent', 'consent', '2026-10-24', '2026-11-07')`,
  )
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated, and no kind is registered but the feat\'s own, adopting and ending a policy, and the test\'s', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'membership_motion', 'circle_membership_motion')`)
  assert.deepEqual(rows, [])
  assert.deepEqual((await db.query('SELECT kind FROM motion.carries ORDER BY kind')).rows, [{ kind: 'admit' }, { kind: 'end' }, { kind: 'policy' }])
})

test('a kind registers through register_carries; a cite through register_cite, and a guard through register_cite_guard covers those listed before it and after', async () => {
  assert.deepEqual((await db.query(`SELECT kind, label, fields, owner FROM motion.carries WHERE owner = 'test'`)).rows, [
    { kind: 'admit', label: 'Admit a member', fields: [{ name: 'member', label: 'Address', type: 'text' }], owner: 'test' },
  ])
  await db.query('BEGIN')
  try {
    await db.query(`SELECT motion.register_cite('test:thing:adopt', 'test')`)
    await db.query(`SELECT motion.register_cite_guard('motion.proposes(jsonb)', 'test')`)
    await db.query(`SELECT motion.register_cite('test:thing:approve', 'test')`)
    assert.deepEqual((await db.query('SELECT op, owner FROM motion.cites ORDER BY op')).rows, [
      { op: 'motion:policy:adopt', owner: 'motion' },
      { op: 'motion:policy:end', owner: 'motion' },
      { op: 'test:thing:adopt', owner: 'test' },
      { op: 'test:thing:approve', owner: 'test' },
    ])
    const { rows } = await db.query(`SELECT op FROM cella.guard WHERE fn = 'motion.proposes(jsonb)'::regprocedure AND op LIKE 'test:%' ORDER BY op`)
    assert.deepEqual(rows, [{ op: 'test:thing:adopt' }, { op: 'test:thing:approve' }])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('the register functions are a migration\'s, not the app\'s', async () => {
  const { rows } = await db.query(`SELECT has_function_privilege('cella_app', f, 'EXECUTE') AS may FROM unnest(ARRAY[
    'motion.register_carries(text, text, jsonb, text)', 'motion.register_cite(text, text)', 'motion.register_cite_guard(regprocedure, text)']::regprocedure[]) f`)
  assert.deepEqual(rows, [{ may: false }, { may: false }, { may: false }])
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
