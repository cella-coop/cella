// A decision's deliberation, alone, on a database holding only the app's
// core and this feat: a message answers one of the same decision posted
// before it, a closed decision takes none, and a text's mentions and links
// are read from it. Run by `cella test slice decision`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { links, mentions, parts, threaded, type Message } from '../src/models/thread.ts'

const db = new pg.Client()

const rejects = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), says)
  } finally {
    await db.query('ROLLBACK')
  }
}
const post = (receipt: number, decision: string, reply: number | null, body = 'Agreed.') =>
  db.query(`INSERT INTO decision.message (receipt, decision, member, reply, body, at) VALUES ($1, $2, 'camille@lanterne.example', $3, $4, '2026-10-24')`, [
    receipt,
    decision,
    reply,
    body,
  ])

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline) VALUES
       ('d-2026-201', 'ag', 'Open', 'majority', 'majority', '2026-10-20', '2026-11-03'),
       ('d-2026-202', 'ag', 'Other', 'majority', 'majority', '2026-10-20', '2026-11-03'),
       ('d-2026-203', 'ag', 'Closed', 'majority', 'majority', '2026-10-01', '2026-10-15')`,
  )
  await db.query(`UPDATE decision.decision SET closed = '2026-10-15', cutoff = 900 WHERE id = 'd-2026-203'`)
})

after(async () => {
  await db.end()
})

test('a message answers one of the same decision, posted before it', async () => {
  await post(1001, 'd-2026-201', null)
  await post(1002, 'd-2026-201', 1001)
  await post(1003, 'd-2026-202', null)
  await rejects(`INSERT INTO decision.message (receipt, decision, member, reply, body, at) VALUES (1004, 'd-2026-202', 'x', 1001, 'No.', '2026-10-24')`, [], /message_decision_reply_fkey/)
  await rejects(`INSERT INTO decision.message (receipt, decision, member, reply, body, at) VALUES (1000, 'd-2026-201', 'x', 1002, 'No.', '2026-10-24')`, [], /message_check/)
  await rejects(`INSERT INTO decision.message (receipt, decision, member, body, at) VALUES (1005, 'd-2026-201', 'x', '  ', '2026-10-24')`, [], /message_body_check/)
})

test('a closed decision takes no message', async () => {
  await rejects(
    `INSERT INTO decision.message (receipt, decision, member, body, at) VALUES (1006, 'd-2026-203', 'x', 'Too late.', '2026-10-24')`,
    [],
    /d-2026-203 is closed/,
  )
})

test('a text mentions by handle or address, after a space, and links documents by id', () => {
  const text = 'Thanks @Amina, and @hugo@lanterne.example. Write to julien@lanterne.example; see [[internal-rules]] and [[Internal-Rules@3]], @amina.'
  assert.deepEqual(mentions(text), ['amina', 'hugo@lanterne.example'])
  assert.deepEqual(links(text), ['internal-rules', 'internal-rules@3'])
  assert.deepEqual(parts('Hi @amina.'), [{ text: 'Hi ' }, { mention: 'amina' }, { text: '.' }])
  assert.deepEqual(parts('[[rate-card]]'), [{ link: 'rate-card' }])
  assert.deepEqual(parts('no mention'), [{ text: 'no mention' }])
})

test('a thread reads each reply under the message it answers', () => {
  const m = (receipt: number, reply: number | null): Message => ({ receipt, reply, member: 'x', body: '', mentions: [], links: [], at: '2026-10-24' })
  const order = threaded([m(5, 1), m(1, null), m(3, null), m(7, 5), m(6, 1)]).map((x) => [x.receipt, x.depth])
  assert.deepEqual(order, [
    [1, 0],
    [5, 1],
    [7, 2],
    [6, 1],
    [3, 0],
  ])
})
