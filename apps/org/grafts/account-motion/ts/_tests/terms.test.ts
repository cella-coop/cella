// Capital terms adopted as a rule, on a database holding the app's core,
// the account and motion feats and this graft: a proposal adopting a rule
// of the account feat's values is refused unless they make sound terms
// replacing those that govern, and one ending a rule terms copy is
// refused; copying terms cites the motion that adopted the rule, never
// another. That the motion passed is circle-membership-motion's, not
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

test('a proposal adopts a capital rule only as sound terms, replacing those that govern, and ends none', async () => {
  await move('m-1', 1, { kind: 'rule', wording: capital('50 €', 20) })
  assert.equal(await guard('account_motion.asks', { motion: 'm-1' }), null)
  await move('m-2', 1, { kind: 'rule', wording: capital('50 €', 20).replace(/; one who leaves.*$/, '') })
  assert.equal(await guard('account_motion.asks', { motion: 'm-2' }), 'the capital\'s terms mark account_delay too')
  await move('m-3', 1, { kind: 'rule', wording: 'Remote work is at most {remote: 3 | less is stricter} days a week' })
  assert.equal(await guard('account_motion.asks', { motion: 'm-3' }), null, 'a rule of no value of the account feat\'s is not its to check')

  await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-1', 1, '2026-11-07', NULL, NULL)`, [capital('50 €', 20)])
  await db.query(`SELECT account.terms_from('m-1/1')`)
  await db.query(`SET cella.clock = '2026-11-07'`)
  assert.equal(await guard('account_motion.asks', { motion: 'm-1' }), 'the capital\'s terms replace those that govern, m-1/1')
  await move('m-4', 1, { kind: 'rule', wording: capital('25 €', 10), replaces: 'm-1/1' })
  assert.equal(await guard('account_motion.asks', { motion: 'm-4' }), null)
  await move('m-5', 1, { policy: 'm-1/1' }, 'end')
  assert.equal(await guard('account_motion.asks', { motion: 'm-5' }), 'm-1/1 are the capital\'s terms: later terms replace them, and none end them')
})

test('copying terms cites the motion that adopted the rule, never another', async () => {
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-1' }), null)
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-2' }), 'm-2 adopted no rule m-1/1')
  assert.equal(await guard('account_motion.adopts', { policy: 'm-1/1', motion: 'm-9' }), 'no motion m-9')
})

test('the op cites a motion, so the roll\'s guard attaches to it', async () => {
  assert.deepEqual((await db.query(`SELECT owner FROM motion.cites WHERE op = 'account:terms:adopt'`)).rows, [{ owner: 'account-motion' }])
})
