// A motion's deliberation, alone, on a database holding only the app's
// core and this feat: a message answers one of the same motion posted
// before it, a closed motion takes none, and the table generates a
// text's mentions and links from it, as the parser reads them. Run by
// `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { conversations, links, mentions, parts, threaded, type Message } from '../src/models/thread.ts'

const db = new pg.Client()

const rejects = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(db.query(sql, values), says)
  } finally {
    await db.query('ROLLBACK')
  }
}
const post = (receipt: number, motion: string, reply: number | null, body = 'Agreed.') =>
  db.query(`INSERT INTO motion.message (receipt, motion, member, reply, body, at) VALUES ($1, $2, 'camille@lanterne.example', $3, $4, '2026-10-24')`, [
    receipt,
    motion,
    reply,
    body,
  ])

before(async () => {
  await db.connect()
  await db.query(
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES
       ('m-2026-201', 'ag', 'camille@lanterne.example', 'Open', 'majority', 'majority', '2026-10-20', '2026-11-03'),
       ('m-2026-202', 'ag', 'camille@lanterne.example', 'Other', 'majority', 'majority', '2026-10-20', '2026-11-03'),
       ('m-2026-203', 'ag', 'camille@lanterne.example', 'Closed', 'majority', 'majority', '2026-10-01', '2026-10-15')`,
  )
  await db.query(`UPDATE motion.motion SET closed = '2026-10-15', cutoff = 900 WHERE id = 'm-2026-203'`)
})

after(async () => {
  await db.end()
})

test('a message answers one of the same motion, posted before it', async () => {
  await post(1001, 'm-2026-201', null)
  await post(1002, 'm-2026-201', 1001)
  await post(1003, 'm-2026-202', null)
  await rejects(`INSERT INTO motion.message (receipt, motion, member, reply, body, at) VALUES (1004, 'm-2026-202', 'x', 1001, 'No.', '2026-10-24')`, [], /message_motion_reply_fkey/)
  await rejects(`INSERT INTO motion.message (receipt, motion, member, reply, body, at) VALUES (1000, 'm-2026-201', 'x', 1002, 'No.', '2026-10-24')`, [], /message_check/)
  await rejects(`INSERT INTO motion.message (receipt, motion, member, body, at) VALUES (1005, 'm-2026-201', 'x', '  ', '2026-10-24')`, [], /message_body_check/)
})

test('a closed motion takes no message', async () => {
  await rejects(
    `INSERT INTO motion.message (receipt, motion, member, body, at) VALUES (1006, 'm-2026-203', 'x', 'Too late.', '2026-10-24')`,
    [],
    /m-2026-203 is closed/,
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

test('the table generates a message’s mentions and links from its text, as the parser reads them', async () => {
  const texts = [
    'Thanks @Amina, and @hugo@lanterne.example. Write to julien@lanterne.example; see [[internal-rules]] and [[Internal-Rules@3]], @amina.',
    '@malik what would it take? [[rate-card-2027@2]]',
    'Ask @lea_. or @chloe-, (@sofia) and x@yusuf: [[]] [[-no]]',
    'no mention',
  ]
  for (const text of texts) {
    const { rows } = await db.query(`SELECT motion.mentions($1) AS mentions, motion.links($1) AS links`, [text])
    assert.deepEqual(rows[0], { mentions: mentions(text), links: links(text) }, text)
  }
  await post(1010, 'm-2026-201', null, 'Over to @amina, see [[internal-rules]].')
  const { rows } = await db.query(`SELECT mentions, links FROM motion.message WHERE receipt = 1010`)
  assert.deepEqual(rows[0], { mentions: ['amina'], links: ['internal-rules'] })
  await rejects(
    `INSERT INTO motion.message (receipt, motion, member, body, mentions, links, at) VALUES (1011, 'm-2026-201', 'x', 'Agreed.', '{amina}', '{internal-rules}', '2026-10-24')`,
    [],
    /cannot insert a non-DEFAULT value into column "mentions"/,
  )
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
  const cards = conversations([m(5, 1), m(1, null), m(3, null), m(7, 5), m(6, 1)]).map((c) => [c.root.receipt, c.messages.map((x) => x.receipt)])
  assert.deepEqual(cards, [
    [1, [1, 5, 7, 6]],
    [3, [3]],
  ], 'each root is a conversation holding every reply under it')
})
