// Capital terms adopted as a rule, on a database holding the app's core,
// the account and motion feats and this graft: a proposal adopting a rule
// of the account feat's values is refused unless they make sound terms
// replacing the latest, and one ending a rule terms copy is
// refused; copying terms cites the motion that adopted the rule, never
// another; a capital write cites a motion that admitted or excluded its
// own member. That the motion passed is membership-motion's, not
// migrated here. Run by `cella test slice account-motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (motion: string, n: number, args: object, kind = 'policy') =>
  db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, $3, $4)`, [motion, n, kind, args])

const capital = (share: string, minimum: number) =>
  `A share is worth {account_share: ${share} | more is stricter}; each associate subscribes at least {account_minimum: ${minimum} | more is stricter} shares, ` +
  'paid in at most {account_instalments: 10 | less is stricter} monthly instalments; one who leaves is repaid from {account_delay: 12 | more is stricter} months ' +
  'after the exit, in {account_repayments: 3 | more is stricter} yearly repayments'

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  for (const m of ['m-1', 'm-2', 'm-3', 'm-4', 'm-5']) {
    await decide(m)
  }
})

after(async () => {
  await db.end()
})

test('a proposal adopts a capital rule only as sound terms, replacing the latest, and ends none', async () => {
  await move('m-1', 1, { kind: 'rule', wording: capital('50 €', 20) })
  assert.equal(await guard('account_motion.asks', { motion: 'm-1' }), null)
  await move('m-2', 1, { kind: 'rule', wording: capital('50 €', 20).replace(/; one who leaves.*$/, '') })
  assert.equal(await guard('account_motion.asks', { motion: 'm-2' }), 'the capital\'s terms mark account_delay too')
  await move('m-3', 1, { kind: 'rule', wording: 'Remote work is at most {remote: 3 | less is stricter} days a week' })
  assert.equal(await guard('account_motion.asks', { motion: 'm-3' }), null, 'a rule of no value of the account feat\'s is not its to check')

  await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-1', 1, '2026-11-07', NULL, NULL)`, [capital('50 €', 20)])
  await db.query(`SELECT account.terms_from('m-1/1')`)
  await db.query(`SET cella.clock = '2026-11-07'`)
  assert.equal(
    await guard('account_motion.asks', { motion: 'm-1' }),
    'the capital\'s terms replace the latest, m-1/1, which apply from 2026-11-07: a rule replacing them names them and applies on or after that day',
  )
  await move('m-4', 1, { kind: 'rule', wording: capital('25 €', 10), replaces: 'm-1/1' })
  assert.equal(await guard('account_motion.asks', { motion: 'm-4' }), null)
  await move('m-5', 1, { policy: 'm-1/1' }, 'end')
  assert.equal(await guard('account_motion.asks', { motion: 'm-5' }), 'm-1/1 are the capital\'s terms: later terms replace them, and none end them')
})

test('while later terms wait, a capital rule replaces those, from their day or later, never the terms that govern', async () => {
  const terms = async (day: string) =>
    (await db.query<{ policy: string }>('SELECT policy FROM account.terms WHERE id = account.capital_for($1::date)', [day])).rows[0]?.policy
  await db.query('BEGIN')
  try {
    // Terms adopted on 7 November to apply on 1 January replace m-1/1.
    await decide('m-8')
    await move('m-8', 1, { kind: 'rule', wording: capital('30 €', 15), from: '2027-01-01', replaces: 'm-1/1' })
    await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-8', 1, '2027-01-01', NULL, 'm-1/1')`, [capital('30 €', 15)])
    await db.query(`SELECT account.terms_from('m-8/1')`)
    assert.equal(await terms('2026-12-31'), 'm-1/1')
    assert.equal(await terms('2027-01-01'), 'm-8/1')

    await decide('m-9')
    await move('m-9', 1, { kind: 'rule', wording: capital('40 €', 12), from: '2027-02-01', replaces: 'm-1/1' })
    assert.equal(
      await guard('account_motion.asks', { motion: 'm-9' }),
      'the capital\'s terms replace the latest, m-8/1, which apply from 2027-01-01: a rule replacing them names them and applies on or after that day',
    )
    assert.match((await guard('motion.asks', { motion: 'm-9' })) ?? '', /m-8\/1 replaces m-1\/1 already, from 2027-01-01: a policy replacing it now replaces m-8\/1/)

    await db.query(`UPDATE motion.action SET args = args || '{"replaces": "m-8/1", "from": "2026-12-01"}' WHERE motion = 'm-9'`)
    assert.equal(await guard('account_motion.asks', { motion: 'm-9' }), null)
    assert.match((await guard('motion.asks', { motion: 'm-9' })) ?? '', /no rule of ag in force on 2026-12-01 is m-8\/1: it applies from 2027-01-01/)

    await db.query(`UPDATE motion.action SET args = args || '{"from": "2027-02-01"}' WHERE motion = 'm-9'`)
    assert.equal(await guard('account_motion.asks', { motion: 'm-9' }), null)
    assert.equal(await guard('motion.asks', { motion: 'm-9' }), null)
    await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-9', 1, '2027-02-01', NULL, 'm-8/1')`, [capital('40 €', 12)])
    await db.query(`SELECT account.terms_from('m-9/1')`)
    assert.deepEqual([await terms('2026-12-31'), await terms('2027-01-31'), await terms('2027-02-01')], ['m-1/1', 'm-8/1', 'm-9/1'])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('copying terms cites the motion that adopted the rule, never another', async () => {
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-1' }), null)
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-2' }), 'm-2 adopted no rule m-1/1')
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-9' }), 'no motion m-9')
})

test('the op cites a motion, so the roll\'s guard attaches to it', async () => {
  assert.deepEqual((await db.query(`SELECT owner FROM motion.cites WHERE op = 'account:terms:adopt'`)).rows, [{ owner: 'account-motion' }])
})

test('a subscription, a withdrawal or a freeze cites a motion that admitted or excluded its own member, never another\'s', async () => {
  // The kinds membership-motion registers, not migrated here.
  await db.query(`SELECT motion.register_carries('admit', 'Admit a member', '[]', 'membership:member:admit', 'membership-motion')`)
  await db.query(`SELECT motion.register_carries('exclude', 'Exclude a member', '[]', 'membership:member:exclude', 'membership-motion')`)
  await decide('m-6')
  await move('m-6', 1, { member: 'ada@lanterne.coop', shares: 20 }, 'admit')
  await decide('m-7')
  await move('m-7', 1, { member: 'bo@lanterne.coop' }, 'exclude')

  assert.equal(await guard('account_motion.admits', { motion: 'm-6', member: 'ada@lanterne.coop' }), null)
  assert.equal(await guard('account_motion.admits', { motion: 'm-6', member: 'cy@lanterne.coop' }), 'm-6 does not admit cy@lanterne.coop')
  assert.equal(await guard('account_motion.admits', { motion: 'm-7', member: 'bo@lanterne.coop' }), 'm-7 does not admit bo@lanterne.coop', 'an exclusion admits no one')
  assert.equal(await guard('account_motion.admits', { motion: 'm-9', member: 'ada@lanterne.coop' }), 'no motion m-9')

  assert.equal(await guard('account_motion.excludes', { motion: 'm-7', member: 'bo@lanterne.coop' }), null)
  assert.equal(await guard('account_motion.excludes', { motion: 'm-7', holder: 'bo@lanterne.coop' }), null)
  assert.equal(await guard('account_motion.excludes', { motion: 'm-7', member: 'cy@lanterne.coop' }), 'm-7 does not exclude cy@lanterne.coop')
  assert.equal(await guard('account_motion.excludes', { motion: 'm-7', holder: 'cy@lanterne.coop' }), 'm-7 does not exclude cy@lanterne.coop')
  assert.equal(await guard('account_motion.excludes', { motion: 'm-6', holder: 'ada@lanterne.coop' }), 'm-6 does not exclude ada@lanterne.coop', 'an admission excludes no one')

  const guards = (await db.query<{ op: string; fn: string }>(
    `SELECT op, fn::text FROM cella.guard WHERE owner = 'account-motion' AND op IN ('account:capital:subscribe', 'account:capital:withdraw', 'account:account:freeze') ORDER BY op`,
  )).rows
  assert.deepEqual(guards, [
    { op: 'account:account:freeze', fn: 'account_motion.excludes(jsonb)' },
    { op: 'account:capital:subscribe', fn: 'account_motion.admits(jsonb)' },
    { op: 'account:capital:withdraw', fn: 'account_motion.excludes(jsonb)' },
  ])
})
