// The motion feat's folds (`sql/013-folds.sql`), on a database holding
// the app's core and this feat: a stance and a close as their entries
// carry them, and an adoption by `policy.adopt` on the action's terms,
// which refuses a policy or a hash other than its entry's. Run by `cella
// test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const camille = 'camille@lanterne.example'
const legal =
  'By the {label: folded assembly}\'s procedure, {procedure: folded}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: 1/2} of those on its roll, by {ballot: open} ballot'
const entry = (n: number, op: string, payload: unknown, date = '2026-11-21') => ({ n, op, actor: camille, date, cause: null, payload })
const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R

before(async () => {
  await db.connect()
  // Nothing here outlasts the file: the slice's other tests read the same database.
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name) SELECT 'ag', 'ag' WHERE NOT EXISTS (SELECT FROM circle.grantee g WHERE g.id = 'ag')`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, ballot, proposed, deadline) VALUES ('m-2026-190', 'ag', 'x', 'consent', 'consent', 'secret', '2026-11-07', '2026-11-21')`,
  )
  await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-190', 1, 'policy', $1)`, [{ kind: 'procedure', wording: legal }])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a secret stance folds as its commitment, an open one as it was given, and a close by the cutoff its entry carries', async () => {
  await db.query('SELECT motion.fold_vote($1)', [entry(2, 'motion:motion:vote', { motion: 'm-2026-190', member: camille, stance: { $commit: '7'.repeat(64) }, receipt: 40 }, '2026-11-08')])
  await db.query('SELECT motion.fold_close($1)', [entry(3, 'motion:motion:close', { motion: 'm-2026-190', closed: '2026-11-21', cutoff: 41 })])
  assert.deepEqual(await one(`SELECT stance, to_char(at, 'YYYY-MM-DD') AS at FROM motion.vote WHERE receipt = 40`), { stance: 'redacted', at: '2026-11-08' })
  assert.deepEqual(await one(`SELECT to_char(closed, 'YYYY-MM-DD') AS closed, cutoff::int FROM motion.motion WHERE id = 'm-2026-190'`), { closed: '2026-11-21', cutoff: 41 })
})

test('an adoption folds by policy.adopt to the policy and hash its entry names, and refuses another hash', async () => {
  // What the handler adopted, read and undone, as the entry would carry it.
  await db.query('SAVEPOINT s')
  await db.query(`SET LOCAL cella.clock = '2026-11-21'`)
  const { id } = await one<{ id: string }>(`SELECT policy.adopt('ag', 'procedure', $1, NULL, 'm-2026-190', 1, '2026-11-21', NULL, NULL) AS id`, [legal])
  const made = await one<{ id: string; hash: string }>(`SELECT id, encode(hash, 'hex') AS hash FROM policy.policy WHERE id = $1`, [id])
  await db.query('ROLLBACK TO SAVEPOINT s')
  const adopt = (hash: string) => entry(4, 'motion:policy:adopt', { policy: made.id, motion: 'm-2026-190', n: 1, applies: '2026-11-21', hash, mandate: null, revoked: [] })
  await db.query('SAVEPOINT s')
  try {
    await db.query(`SET LOCAL cella.clock = '2026-11-21'`)
    await assert.rejects(db.query('SELECT motion.fold_adopt($1)', [adopt('0'.repeat(64))]), /entry 4 adopts m-2026-190\/1 hashed 0+, where the fold adopts m-2026-190\/1 hashed/)
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT s')
  }
  await db.query(`SET LOCAL cella.clock = '2026-11-21'`)
  await db.query('SELECT motion.fold_adopt($1)', [adopt(made.hash)])
  assert.deepEqual(await one(`SELECT id, method, policy FROM motion.procedure WHERE policy = $1`, [made.id]), { id: 'folded', method: 'majority', policy: made.id })
})
