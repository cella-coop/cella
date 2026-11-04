// The work share's terms adopted as a rule, on a database holding the
// app's core, the motion and patronage feats and this graft: a proposal
// adopting a rule of the patronage feat's values is refused unless they
// make sound terms, from the first of a year, replacing the latest; one
// ending a rule terms copy is refused; copying terms cites the motion that
// adopted the rule, never another. That the motion passed is
// membership-motion's, not migrated here. Run by `cella test slice
// motion-patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const guard = async (fn: string, payload: object) => (await db.query<{ r: string | null }>(`SELECT ${fn}($1) AS r`, [payload])).rows[0].r
const decide = (id: string) =>
  db.query(`INSERT INTO motion.motion (id, circle, title, method, procedure, proposed, deadline) VALUES ($1, 'ag', 'Terms', 'consent', 'consent', '2026-10-24', '2026-11-07')`, [id])
const move = (motion: string, n: number, args: object, kind = 'policy') =>
  db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, $3, $4)`, [motion, n, kind, args])

const rule = (salary: string, hours: string) =>
  `The work share is divided {patronage_salary: ${salary} | more is stricter} by pay, {patronage_hours: ${hours} | more is stricter} by time worked ` +
  'and {patronage_equal: 0 % | more is stricter} in equal parts; {patronage_capital: 50 % | more is stricter} of an associate\'s part buys shares, ' +
  'and capital earns at most {patronage_interest: 3.5 % | less is stricter}'

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  for (const m of ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']) {
    await decide(m)
  }
})

after(async () => {
  await db.end()
})

test('a proposal adopts a work share rule only as sound terms from the first of a year, replacing the latest, and ends none', async () => {
  await move('m-1', 1, { kind: 'rule', wording: rule('100 %', '0 %'), from: '2027-01-01' })
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-1' }), null)
  await move('m-2', 1, { kind: 'rule', wording: rule('60 %', '30 %'), from: '2027-01-01' })
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-2' }), 'the work share\'s terms divide 90 % of the work share, not 100 %')
  await move('m-3', 1, { kind: 'rule', wording: rule('60 %', '40 %'), from: '2027-03-01' })
  assert.match((await guard('motion_patronage.asks', { motion: 'm-3' })) ?? '', /apply from the first day of a fiscal year/)
  await move('m-4', 1, { kind: 'rule', wording: 'Remote work is at most {remote_days: 3 | less is stricter} days a week' })
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-4' }), null, 'a rule of no value of the patronage feat\'s is not its to check')

  await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-1', 1, '2027-01-01', NULL, NULL)`, [rule('100 %', '0 %')])
  await db.query(`SELECT patronage.terms_from('m-1/1')`)
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-1' }), 'the work share\'s terms replace the latest, m-1/1')
  await move('m-5', 1, { kind: 'rule', wording: rule('60 %', '40 %'), from: '2028-01-01', replaces: 'm-1/1' })
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-5' }), null)
  await move('m-6', 1, { policy: 'm-1/1' }, 'end')
  assert.equal(await guard('motion_patronage.asks', { motion: 'm-6' }), 'm-1/1 are the work share\'s terms: later terms replace them, and none end them')
})

test('copying terms cites the motion that adopted the rule, never another', async () => {
  assert.equal(await guard('motion_patronage.adopts', { policy: 'm-1/1', motion: 'm-1' }), null)
  assert.equal(await guard('motion_patronage.adopts', { policy: 'm-1/1', motion: 'm-2' }), 'm-2 adopted no rule m-1/1')
  assert.equal(await guard('motion_patronage.adopts', { policy: 'm-1/1', motion: 'm-9' }), 'no motion m-9')
})

test('the op cites a motion, so the roll\'s guard attaches to it', async () => {
  assert.deepEqual((await db.query(`SELECT owner FROM motion.cites WHERE op = 'patronage:terms:adopt'`)).rows, [{ owner: 'motion-patronage' }])
})
