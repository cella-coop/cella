// A person holds a role by a tenure, end to end on a seeded Lanterne:
// Camille holds the manager role from 20 June 2024 until 20 June 2028
// and approves an expense under its mandates while it runs; a second
// tenure of the manager role, capped at one, is refused while hers runs
// and taken from the day it ends; and the assembly hands Web's lead from
// Yusuf to Léa, which keeps every mandate on the role and seats Léa in
// coordination, where the lead role is a member. Run by `cella test e2e
// tenure`.

import { test as runTest } from 'node:test'
import { createStory } from './story.ts'
export const { before, after, test, story } = createStory()
import assert from 'node:assert/strict'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import { capture, submit as claim } from '@cella/org-expense/api'
import { approve as approveExpense } from '@cella/org-graft-expense-transaction/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'

const su = new pg.Client()
let app: pg.Client

const at = (name: string) => `${name}@lanterne.example`
const camille = at('camille')
const julien = at('julien')
const yusuf = at('yusuf')
const lea = at('lea')
const thomas = at('thomas')
const assembly = ['camille', 'yusuf', 'hugo', 'malik', 'julien', 'amina', 'thomas', 'lea', 'chloe', 'sofia'].map(at)

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const may = async (actor: string, power: string, day: string) =>
  (await one<{ may: boolean }>('SELECT circle_person.may($1, $2, NULL, NULL, $3) AS may', [actor, power, day])).may
const seated = async (circle: string, day: string) =>
  (await all<{ s: string }>('SELECT s FROM circle.seated($1, $2) s ORDER BY s', [circle, day])).map((r) => r.s)

before(async () => {
  await su.connect()
  // The host stages a tenure around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
  await on('2026-10-24')
})

after(async () => {
  await app.end()
  await su.end()
})

test('Camille holds the manager role by a tenure, 2024 to 2028, and approves an expense under it', async () => {
  assert.deepEqual(
    await one(
      `SELECT circle, to_char(since, 'YYYY-MM-DD') AS since, to_char(until, 'YYYY-MM-DD') AS until
       FROM circle.tenure WHERE holder = $1 AND role = 'manager'`,
      [camille],
    ),
    { circle: 'ag', since: '2024-06-20', until: '2028-06-20' },
  )
  const desk = settled(
    await capture({ member: thomas, day: '2026-10-24', label: 'Standing desk', category: '606', net: 500_00, vat: 100_00, receipt: null }, as(thomas)),
  )
  settled(await claim({ expense: desk.expense }, as(thomas)))
  settled(await approveExpense({ expense: desk.expense }, as(camille)))

  assert.equal(await may(camille, 'approve-expense', '2028-06-19'), true, 'her tenure runs')
  assert.equal(await may(camille, 'approve-expense', '2028-06-20'), false, 'her tenure has ended')
  assert.equal(await may(camille, 'approve-expense', '2024-06-19'), false, 'her tenure had not begun')
})

test('a second tenure of the manager role, capped at one, is refused while hers runs and taken from the day it ends', async () => {
  assert.equal((await one<{ holders: number }>(`SELECT holders FROM circle.role WHERE id = 'manager'`)).holders, 1)
  await su.query('BEGIN')
  try {
    await assert.rejects(
      su.query(`INSERT INTO circle.tenure (circle, holder, role, since) VALUES ('ag', $1, 'manager', '2026-11-01')`, [julien]),
      /the manager role is held by 1 at most in ag, and this tenure would make 2 holders on 2026-11-01/,
    )
  } finally {
    await su.query('ROLLBACK')
  }
  await su.query('BEGIN')
  try {
    await su.query(`INSERT INTO circle.tenure (circle, holder, role, since) VALUES ('ag', $1, 'manager', '2028-06-20')`, [julien])
    assert.equal(await may(julien, 'commit', '2028-06-20'), true, 'the next manager holds the role from the day hers ends')
    assert.equal(await may(julien, 'commit', '2028-06-19'), false)
  } finally {
    await su.query('ROLLBACK')
  }
  await assert.rejects(
    su.query(`INSERT INTO circle.tenure (circle, holder, role) VALUES ('web', $1, 'finance')`, [julien]),
    /the finance role is operations circle's, not web's/,
  )
})

test('handing Web\'s lead from Yusuf to Léa keeps every mandate on the role and seats Léa in coordination', async () => {
  const mandates = `SELECT count(*)::int AS n FROM circle.mandate WHERE grantee = 'lead' AND revoked IS NULL`
  const before_ = await one<{ n: number }>(mandates)
  assert.ok(before_.n > 0)
  assert.deepEqual(await seated('coordination', '2026-10-24'), [camille, at('hugo'), julien, at('malik'), yusuf].sort())
  assert.equal(await may(lea, 'send-quote', '2026-10-24'), false)

  const { motion } = settled(
    await propose(
      {
        circle: 'ag',
        title: 'Léa leads Web after Yusuf',
        procedure: 'consent',
        deadline: '2026-10-31',
        body: '',
        actions: [
          { kind: 'unseat', args: { circle: 'web', member: yusuf, role: 'lead' } },
          { kind: 'seat', args: { circle: 'web', member: lea, role: 'lead' } },
        ],
      },
      as(camille),
    ),
  )
  for (const member of assembly) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  await on('2026-10-31')
  settled(await close({ motion }, as(camille)))
  const out = await carried(motion, as(camille))
  assert.deepEqual(
    out.map((d) => [d.op, d.state]),
    [
      ['circle:seat:remove', 'settled'],
      ['circle:seat:add', 'settled'],
    ],
  )

  assert.deepEqual(
    await all(
      `SELECT holder, to_char(since, 'YYYY-MM-DD') AS since, to_char(until, 'YYYY-MM-DD') AS until
       FROM circle.tenure WHERE role = 'lead' AND circle = 'web' ORDER BY id`,
    ),
    [
      { holder: yusuf, since: null, until: '2026-10-31' },
      { holder: lea, since: '2026-10-31', until: null },
    ],
  )
  assert.deepEqual(await one(mandates), before_, 'the handover ends no mandate')
  assert.equal(await may(lea, 'send-quote', '2026-10-31'), true)
  assert.equal(await may(yusuf, 'send-quote', '2026-10-31'), false)
  assert.deepEqual(await seated('coordination', '2026-10-31'), [camille, at('hugo'), julien, lea, at('malik')].sort())
  assert.deepEqual(await seated('coordination', '2026-10-30'), [camille, at('hugo'), julien, at('malik'), yusuf].sort())
})

if (!process.env.CELLA_STORY) runTest('tenure story', async (t) => story((name, step) => t.test(name, step)))
