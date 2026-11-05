// The motion feat's folds (`sql/013-folds.sql`), on a database holding
// the app's core and this feat: a proposal under the id its entry names,
// its title and text as their commitments, and its actions in order; a
// message as its entry carries it, its text as its commitment; a stance
// and a close as their entries carry them; and an adoption by
// `policy.adopt` on the action's terms, which refuses a policy or a hash
// other than its entry's. Run by `cella test slice motion`.

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
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, ballot, proposed, deadline) VALUES ('m-2026-190', 'ag', 'camille@lanterne.example', 'x', 'consent', 'consent', 'secret', '2026-11-07', '2026-11-21')`,
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

test('a proposal folds as its entry names it, by its actor on its day, its words as their commitments and its actions in order, and a message on it as its commitment', async () => {
  const words = { $commit: 'ab'.repeat(32) }
  await db.query('SELECT motion.fold_propose($1)', [
    entry(5, 'motion:motion:propose', {
      motion: 'm-2026-191', circle: 'ag', author: 'ag', procedure: 'majority', ballot: 'open', deadline: '2026-11-30',
      title: words, body: words,
      actions: [{ kind: 'policy', args: { kind: 'procedure', wording: legal } }, { kind: 'policy', args: { kind: 'procedure', wording: legal, friendly: 'Two thirds.' } }],
    }, '2026-11-09'),
  ])
  assert.deepEqual(
    await one(`SELECT circle, author, proposer, title, body, method, procedure, ballot, to_char(proposed, 'YYYY-MM-DD') AS proposed, to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = 'm-2026-191'`),
    { circle: 'ag', author: 'ag', proposer: camille, title: 'redacted', body: 'redacted', method: 'majority', procedure: 'majority', ballot: 'open', proposed: '2026-11-09', deadline: '2026-11-30' },
  )
  assert.deepEqual((await db.query(`SELECT n, args ->> 'friendly' AS friendly FROM motion.action WHERE motion = 'm-2026-191' ORDER BY n`)).rows, [{ n: 1, friendly: null }, { n: 2, friendly: 'Two thirds.' }])
  assert.deepEqual((await db.query(`SELECT field FROM cella.commitment WHERE n = 5 AND subject = $1 ORDER BY field`, [camille])).rows, [{ field: 'motion.motion.body' }, { field: 'motion.motion.title' }])
  await db.query('SELECT motion.fold_post($1)', [entry(6, 'motion:message:post', { motion: 'm-2026-191', member: camille, message: 44, body: words, mentions: [], links: [] }, '2026-11-10')])
  assert.deepEqual(await one(`SELECT member, reply, body, to_char(at, 'YYYY-MM-DD') AS at FROM motion.message WHERE receipt = 44`), { member: camille, reply: null, body: 'redacted', at: '2026-11-10' })
  await db.query('SAVEPOINT s')
  try {
    await assert.rejects(
      db.query('SELECT motion.fold_post($1)', [entry(7, 'motion:message:post', { motion: 'm-2026-191', member: camille, message: 45, body: 'Agreed.' })]),
      /entry 7 keeps the motion.message.body of camille@lanterne.example as "Agreed.", not as its commitment/,
    )
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT s')
  }
})
