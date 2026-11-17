// A journal entry's body, on a database holding only the app's core and
// this feat: saved on an entry that never changes, saved again the same
// and folded, the posting fixed all the while; refused with another
// column beside it, its id included, and on a line, which has no body;
// updated, on the app's role, in a write's transaction, which sees every
// entry, and outside one only on an entry its reader reads; and saved
// only by whoever reads the entry, never by any member of its circle
// alone. Run by `cella test slice transaction`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const julien = 'julien@body.example'
let id = ''

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async () => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM transaction.entry WHERE id = $1', [id])).rows[0].text
const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('SAVEPOINT refused')
  try {
    await assert.rejects(run(), (e: Error) => (assert.match(e.message, says), true))
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT refused')
  }
}
// As `role` reads and writes, for `actor`, in a write's transaction or not.
const as = async <T>(role: string, actor: string, writing: boolean, run: () => Promise<T>) => {
  await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', $2, true)`, [actor, writing ? 'on' : ''])
  await db.query(`SET LOCAL ROLE ${role}`)
  try {
    return await run()
  } finally {
    await db.query('RESET ROLE')
    await db.query(`SELECT set_config('cella.actor', '', true), set_config('cella.writing', '', true)`)
  }
}

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`SET LOCAL cella.clock = '2041-01-10'`)
  const { rows } = await db.query<{ id: string }>(`INSERT INTO transaction.entry (date, label) VALUES ('2041-01-10', 'body') RETURNING id`)
  id = rows[0].id
  await db.query(
    `INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, 1, '512', 'debit', cella.amount(100)), ($1, 2, '706', 'credit', cella.amount(100))`,
    [id],
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a posted entry takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('The October invoice, paid late')
  await db.query('UPDATE transaction.entry SET body = $2 WHERE id = $1', [id, first])
  await db.query('UPDATE transaction.entry SET body = $2 WHERE id = $1', [id, first])
  assert.equal(await text(), 'The October invoice, paid late')
  await db.query('SELECT transaction.fold_body_save($1)', [{ payload: { transaction: id, snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text(), 'Folded')
})

test('an entry\'s body saved with another column beside it is refused, its id included, and a line changes still never', async () => {
  const permanent = /the journal is permanent: a entry's rows never change/
  await refused(() => db.query(`UPDATE transaction.entry SET body = $2, label = 'x' WHERE id = $1`, [id, body('x')]), permanent)
  await refused(() => db.query(`UPDATE transaction.entry SET body = $2, id = 'je-body' WHERE id = $1`, [id, body('x')]), permanent)
  await refused(() => db.query('UPDATE transaction.line SET n = n WHERE entry = $1', [id]), /the journal is permanent: a line's rows never change/)
})

test('on the app\'s role, a write\'s transaction updates an entry\'s body, and none outside one but an entry its reader reads', async () => {
  const update = () => db.query('UPDATE transaction.entry SET body = $2 WHERE id = $1 RETURNING id', [id, body('Updated')])
  assert.equal((await as('cella_app', julien, true, update)).rowCount, 1, 'a write sees every entry')
  assert.equal((await as('cella_app', 'nobody@body.example', false, update)).rowCount, 0, 'one who does not read the books updates none')
  assert.equal(await text(), 'Updated')
})

test('an entry\'s body is saved by whoever reads the books, never by a member of its circle alone', async () => {
  await db.query('CREATE SCHEMA bodied')
  await db.query(
    `CREATE FUNCTION bodied.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${julien}' AND power = 'record-entry'`,
  )
  await db.query(
    `CREATE FUNCTION bodied.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN bodied.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(
    `INSERT INTO cella.authority (fn, covered, owner) VALUES ('bodied.may(text, text, bigint, text, date)', 'bodied.covered(text, text, date)', 'test')
     ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`,
  )
  const legible = (actor: string) =>
    as('cella_guards', actor, true, async () => (await db.query<{ r: string | null }>('SELECT transaction.legible($1) AS r', [{ transaction: id }])).rows[0].r)
  assert.equal(await legible(julien), null, 'whoever records entries')
  assert.match((await legible('camille@body.example')) ?? '', /^a body's save is by someone who does not read this journal entry of /)
})
