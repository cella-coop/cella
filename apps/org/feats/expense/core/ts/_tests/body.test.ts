// An expense's body, on a database holding only the app's core and this
// feat: saved once the expense is reimbursed, saved again the same and
// folded, its figures and its step fixed all the while; and refused with
// another column beside it, its id included. Run by `cella test slice
// expense`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const sofia = 'sofia@body.example'
let id = ''

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async () => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM expense.expense WHERE id = $1', [id])).rows[0].text
const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('SAVEPOINT refused')
  try {
    await assert.rejects(run(), (e: Error) => (assert.match(e.message, says), true))
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT refused')
  }
}

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`SET LOCAL cella.clock = '2041-01-20'`)
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO expense.expense (id, member, day, label, category, net, vat) VALUES ('ex-body', $1, '2041-01-05', 'Train to Clairval', '6251', cella.amount(15000), cella.amount(3000)) RETURNING id`,
    [sofia],
  )
  id = rows[0].id
  await db.query(`UPDATE expense.expense SET status = 'submitted', submitted = '2041-01-06' WHERE id = $1`, [id])
  await db.query(`UPDATE expense.expense SET status = 'approved', decided = '2041-01-10', decider = 'hugo@body.example' WHERE id = $1`, [id])
  await db.query(`UPDATE expense.expense SET status = 'reimbursed', reimbursed = '2041-01-20' WHERE id = $1`, [id])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a reimbursed expense takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('The return ticket too')
  await db.query('UPDATE expense.expense SET body = $2 WHERE id = $1', [id, first])
  await db.query('UPDATE expense.expense SET body = $2 WHERE id = $1', [id, first])
  assert.equal(await text(), 'The return ticket too')
  await db.query('SELECT expense.fold_body_save($1)', [{ payload: { expense: id, snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text(), 'Folded')
})

test('a reimbursed expense\'s body saved with another column beside it is refused, its id included', async () => {
  await refused(() => db.query(`UPDATE expense.expense SET body = $2, category = '6256' WHERE id = $1`, [id, body('x')]), / was submitted: its figures never change/)
  await refused(() => db.query(`UPDATE expense.expense SET body = $2, id = 'ex-other' WHERE id = $1`, [id, body('x')]), / is reimbursed already/)
})
