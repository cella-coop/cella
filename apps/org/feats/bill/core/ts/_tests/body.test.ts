// A bill's body, on a database holding only the app's core and this feat:
// saved once the bill is paid, saved again the same and folded, its
// figures and its step fixed all the while; and refused with another
// column beside it, its id included. Run by `cella test slice bill`.

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
const text = async () => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM bill.bill WHERE id = $1', [id])).rows[0].text
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
    `INSERT INTO bill.bill (id, supplier, reference, issued, due, label, category, net, vat, total, recorded, recorder)
     VALUES ('bi-body', 'Imprimerie du Parc', 'F-BODY', '2041-01-05', '2041-02-05', 'Paper stock', '606', cella.amount(1000), cella.amount(200), cella.amount(1200), '2041-01-10', $1)
     RETURNING id`,
    [julien],
  )
  id = rows[0].id
  await db.query(`UPDATE bill.bill SET status = 'approved', approved = '2041-01-15', approver = $2 WHERE id = $1`, [id, julien])
  await db.query(`UPDATE bill.bill SET status = 'paid', paid = '2041-01-20' WHERE id = $1`, [id])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a paid bill takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('Paid by transfer')
  await db.query('UPDATE bill.bill SET body = $2 WHERE id = $1', [id, first])
  await db.query('UPDATE bill.bill SET body = $2 WHERE id = $1', [id, first])
  assert.equal(await text(), 'Paid by transfer')
  await db.query('SELECT bill.fold_body_save($1)', [{ payload: { bill: id, snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text(), 'Folded')
})

test('a paid bill\'s body saved with another column beside it is refused, its id included', async () => {
  await refused(() => db.query(`UPDATE bill.bill SET body = $2, label = 'x' WHERE id = $1`, [id, body('x')]), / was recorded: its figures never change/)
  await refused(() => db.query(`UPDATE bill.bill SET body = $2, id = 'bi-other' WHERE id = $1`, [id, body('x')]), / was recorded: its figures never change/)
  await refused(() => db.query(`UPDATE bill.bill SET body = $2, paid = '2041-01-21' WHERE id = $1`, [id, body('x')]), / is paid already/)
})

test('a paid bill paid again, setting the status it holds, is refused: the trigger fires by the columns an update sets, every one but the body', async () => {
  await refused(() => db.query(`UPDATE bill.bill SET status = 'paid' WHERE id = $1`, [id]), / is paid already/)
  const { rows } = await db.query<{ unguarded: string[] }>(
    `SELECT coalesce(array_agg(a.attname::text ORDER BY a.attname), '{}') AS unguarded
     FROM pg_attribute a, pg_trigger t
     WHERE a.attrelid = 'bill.bill'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND t.tgrelid = a.attrelid AND t.tgname = 'moves' AND NOT a.attnum = ANY (t.tgattr::int2[])`,
  )
  assert.deepEqual(rows[0].unguarded, ['body'], 'every column but the body fires moves')
})
