// How a motion is taken, alone, on a database holding only the app's
// core and this feat: a procedure's method, share and quorum, the built-in
// ones, and a motion keeping the method of the procedure it names. Run by
// `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const rejects = async (sql: string, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql), says)
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

test('consent, majority and two thirds are built in', async () => {
  const { rows } = await db.query(
    `SELECT id, method, share_num, share_den, quorum_num FROM motion.procedure WHERE id IN ('consent', 'majority', 'two-thirds') ORDER BY id`,
  )
  assert.deepEqual(rows, [
    { id: 'consent', method: 'consent', share_num: null, share_den: null, quorum_num: 0 },
    { id: 'majority', method: 'majority', share_num: null, share_den: null, quorum_num: 0 },
    { id: 'two-thirds', method: 'majority', share_num: 2, share_den: 3, quorum_num: 0 },
  ])
})

test('a share is a majority’s, more than none and at most all; a quorum at most all', async () => {
  const add = (values: string) => `INSERT INTO motion.procedure (id, label, method, share_num, share_den, quorum_num, quorum_den) VALUES ${values}`
  await rejects(add(`('unanimous-consent', 'x', 'consent', 1, 1, 0, 1)`), /procedure_check/)
  await rejects(add(`('none', 'x', 'majority', 0, 3, 0, 1)`), /procedure_check/)
  await rejects(add(`('more', 'x', 'majority', 4, 3, 0, 1)`), /procedure_check/)
  await rejects(add(`('half', 'x', 'majority', 1, NULL, 0, 1)`), /procedure_check/)
  await rejects(add(`('crowd', 'x', 'majority', NULL, NULL, 3, 2)`), /procedure_check/)
  await rejects(add(`('Loud', 'x', 'majority', NULL, NULL, 0, 1)`), /procedure_id_check/)
})

test('a motion is taken by its procedure’s method, and the procedure is fixed once one is', async () => {
  await db.query(`INSERT INTO motion.procedure (id, label, method, share_num, share_den, quorum_num, quorum_den) VALUES ('statutes', 'Statutes', 'majority', 3, 4, 1, 2)`)
  await rejects(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ('m-2026-090', 'ag', 'x', 'consent', 'statutes', '2026-10-24', '2026-11-07')`,
    /motion_procedure_method_fkey/,
  )
  await rejects(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ('m-2026-090', 'ag', 'x', 'majority', 'nowhere', '2026-10-24', '2026-11-07')`,
    /motion_procedure_method_fkey/,
  )
  await db.query(
    `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ('m-2026-091', 'ag', 'Amend the statutes', 'majority', 'statutes', '2026-10-24', '2026-11-07')`,
  )
  await rejects(`UPDATE motion.procedure SET share_num = 2 WHERE id = 'statutes'`, /motions are taken by statutes: its terms are fixed/)
  await rejects(`DELETE FROM motion.procedure WHERE id = 'statutes'`, /motions are taken by statutes: its terms are fixed/)
})
