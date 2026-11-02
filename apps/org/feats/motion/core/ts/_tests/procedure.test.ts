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

// A procedure policy's terms, as its legal wording marks them.
const twoThirds =
  'By the {label: statutory assembly}\'s procedure, {procedure: statutory}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: 1/2} of those on its roll, by {ballot: open} ballot'

const terms = async (legal: string) => (await db.query('SELECT * FROM motion.terms(motion.marked($1))', [legal])).rows[0]

test('a procedure policy\'s terms are the values its wording marks, a share written as a fraction, a percent or none, roles by id', async () => {
  assert.deepEqual(await terms(twoThirds), {
    id: 'statutory', label: 'Statutory assembly', method: 'majority', share_num: 2, share_den: 3, quorum_num: 1, quorum_den: 2, ballot: 'open', voters: null, veto: [], flaw: null,
  })
  assert.deepEqual(await terms('By {procedure: open-floor}, {method: consent}, with {quorum: 25 %}'), {
    id: 'open-floor', label: 'Open floor', method: 'consent', share_num: null, share_den: null, quorum_num: 25, quorum_den: 100, ballot: 'open', voters: null, veto: [], flaw: null,
  })
  assert.equal((await terms('By {procedure: open-floor}, {method: consent}, with {quorum: none}')).quorum_num, 0)
  // The roles that vote and those that may veto, by id, in order.
  const led = await terms('By {procedure: led}, a {method: majority}, with {quorum: none}, of {voters: secretary, member and lead}, which the {veto: lead} may veto')
  assert.deepEqual([led.voters, led.veto, led.flaw], [['lead', 'member', 'secretary'], ['lead'], null])
})

test('a procedure policy names itself, decides by consent or majority, marks its quorum, a share only for a majority, and nothing else', async () => {
  const flaw = async (legal: string) => (await db.query<{ f: string | null }>('SELECT motion.procedure_flaw(motion.marked($1)) AS f', [legal])).rows[0].f
  assert.equal(await flaw(twoThirds), null)
  assert.match((await flaw('By {procedure: statutory}, a {method: majority} of {share: 2/3}')) ?? '', /marks its quorum, as \{quorum: 1\/4\}/)
  assert.match((await flaw('A {method: majority}, with {quorum: none}')) ?? '', /names its procedure/)
  assert.match((await flaw('By {procedure: Loud}, {method: majority}, with {quorum: none}')) ?? '', /Loud is no procedure's name/)
  assert.match((await flaw('By {procedure: shout}, {method: acclamation}, with {quorum: none}')) ?? '', /consent or majority, as \{method: majority\}, not acclamation/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: 3/2}')) ?? '', /a quorum is a share of the roll, as 1\/4, 25 % or none, not 3\/2/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: most}')) ?? '', /not most/)
  assert.match((await flaw('By {procedure: crowd}, {method: consent}, {share: 2/3}, with {quorum: none}')) ?? '', /a share is a majority's/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, {share: 0/3}, with {quorum: none}')) ?? '', /more than none of the votes cast and at most all/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: none}, by {ballot: show} of hands')) ?? '', /a ballot is open or secret, not show/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: none}, {delegates: coordination}')) ?? '', /marks its procedure, label, method, share, quorum, ballot, voters and veto, not delegates/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: none}, by {voters: Circle Leads}')) ?? '', /names the roles that vote by id, as \{voters: lead, secretary\}, not Circle Leads/)
  assert.match((await flaw('By {procedure: crowd}, {method: majority}, with {quorum: none}, the {veto: , } may veto')) ?? '', /names the roles that may veto by id/)
  // A name taken: a built-in one only on its own terms, and none a policy made.
  assert.equal(await flaw('By {procedure: two-thirds}, a {method: majority} of {share: 2/3}, with {quorum: none}'), null)
  assert.match((await flaw('By {procedure: two-thirds}, a {method: majority} of {share: 2/3}, with {quorum: 1/2}')) ?? '', /two-thirds is a procedure already, and its terms are fixed/)
})

test('adopting a procedure policy makes its procedure, or names the built-in one it repeats; one ended puts no motion', async () => {
  const adopt = (legal: string, n: number, replaces: string | null = null) =>
    db.query(`SELECT policy.adopt('ag', 'procedure', $1, NULL, 'm-2026-092', $2, '2026-11-21', NULL, $3) AS id`, [legal, n, replaces])
  await db.query('BEGIN')
  try {
    await db.query(`SET LOCAL cella.clock = '2026-11-21'`)
    await adopt(twoThirds, 1)
    assert.equal((await db.query<{ p: string }>(`SELECT motion.procedure_from('m-2026-092/1') AS p`)).rows[0].p, 'statutory')
    assert.deepEqual(
      (await db.query(`SELECT id, label, method, share_num, share_den, quorum_num, quorum_den, ballot, policy FROM motion.procedure WHERE id = 'statutory'`)).rows,
      [{ id: 'statutory', label: 'Statutory assembly', method: 'majority', share_num: 2, share_den: 3, quorum_num: 1, quorum_den: 2, ballot: 'open', policy: 'm-2026-092/1' }],
    )
    // A built-in procedure, already counted by, comes to name its policy, its terms unchanged.
    await db.query(
      `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ('m-2026-093', 'ag', 'x', 'consent', 'consent', '2026-11-21', '2026-12-05')`,
    )
    await adopt('By {procedure: consent}, {method: consent}, with a quorum of {quorum: none}', 2)
    await db.query(`SELECT motion.procedure_from('m-2026-092/2')`)
    assert.equal((await db.query(`SELECT policy FROM motion.procedure WHERE id = 'consent'`)).rows[0].policy, 'm-2026-092/2')
    await assert.rejects(db.query(`UPDATE motion.procedure SET policy = NULL WHERE id = 'consent'`), /motions are taken by consent: its terms are fixed/)
  } finally {
    await db.query('ROLLBACK')
  }

  await db.query('BEGIN')
  try {
    await db.query(`SET LOCAL cella.clock = '2026-12-01'`)
    await adopt(twoThirds, 1)
    await db.query(`SELECT motion.procedure_from('m-2026-092/1')`)
    // Taken again, the name refuses the copy.
    await adopt(twoThirds.replace('2/3', '3/4'), 2)
    await assert.rejects(db.query(`SELECT motion.procedure_from('m-2026-092/2')`), /statutory is a procedure already/)
  } finally {
    await db.query('ROLLBACK')
  }

  const decides = async (clock: string) => {
    await db.query('BEGIN')
    try {
      await db.query(`SELECT set_config('cella.clock', $1, true)`, [clock])
      await adopt(twoThirds, 1)
      await db.query(`SELECT motion.procedure_from('m-2026-092/1')`)
      await adopt(twoThirds.replace('statutory}', 'amendments}'), 2, 'm-2026-092/1')
      await db.query(`SELECT motion.procedure_from('m-2026-092/2')`)
      await db.query(
        `INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ('m-2026-094', 'ag', 'x', 'majority', 'statutory', $1, '2026-12-31')`,
        [clock],
      )
      return (await db.query<{ r: string | null }>(`SELECT motion.decides_by('{"motion": "m-2026-094"}') AS r`)).rows[0].r
    } finally {
      await db.query('ROLLBACK')
    }
  }
  assert.match((await decides('2026-11-21')) ?? '', /statutory is no procedure in force: m-2026-092\/1 ended on 2026-11-21/)
})
