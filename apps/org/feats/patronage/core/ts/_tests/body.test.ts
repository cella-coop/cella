// The bodies of patronage, on a database holding only the app's core and
// this feat: adopted terms' and a distributed surplus's saved, saved again
// the same and folded, what was adopted or split fixed all the while; and
// refused with another column beside it, a key included, and a
// distribution distributed again on its own day refused. Run by `cella
// test slice patronage`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async (table: string, id: string) =>
  (await db.query<{ text: string | null }>(`SELECT cella.document_text(body) AS text FROM patronage.${table} WHERE id = $1`, [id])).rows[0].text
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
  await db.query(`SET LOCAL cella.clock = '2041-03-01'`)
  await db.query(`INSERT INTO patronage.terms (id, policy, "from", salary, hours, equal, capital, adopted) VALUES ('t-body', 't-body', 2041, 100, 0, 0, 0, '2041-01-15')`)
  await db.query(`INSERT INTO patronage.distribution (id, year, surplus, basis, approved) VALUES ('2040', 2040, cella.amount(100000), 'salary', '2041-03-01')`)
  await db.query(`INSERT INTO patronage.part (distribution, worker, basis, quantity, amount) VALUES ('2040', 'ana@body.example', 'salary', 100, cella.amount(1000))`)
  await db.query(`UPDATE patronage.distribution SET distributed = '2041-03-01' WHERE id = '2040'`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('adopted terms take their body, saved again the same, and folded from its entry', async () => {
  const first = body('Why pay alone weighs')
  await db.query(`UPDATE patronage.terms SET body = $1 WHERE id = 't-body'`, [first])
  await db.query(`UPDATE patronage.terms SET body = $1 WHERE id = 't-body'`, [first])
  assert.equal(await text('terms', 't-body'), 'Why pay alone weighs')
  await db.query('SELECT patronage.fold_body_save_terms($1)', [{ payload: { terms: 't-body', snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text('terms', 't-body'), 'Folded')
})

test('adopted terms\' body saved with another column beside it is refused, their id included', async () => {
  await refused(() => db.query(`UPDATE patronage.terms SET body = $1, hours = 10 WHERE id = 't-body'`, [body('x')]), /t-body were adopted on/)
  await refused(() => db.query(`UPDATE patronage.terms SET body = $1, id = 't-other' WHERE id = 't-body'`, [body('x')]), /t-body were adopted on/)
})

test('a distributed surplus takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('Distributed as the assembly voted')
  await db.query(`UPDATE patronage.distribution SET body = $1 WHERE id = '2040'`, [first])
  await db.query(`UPDATE patronage.distribution SET body = $1 WHERE id = '2040'`, [first])
  assert.equal(await text('distribution', '2040'), 'Distributed as the assembly voted')
  await db.query('SELECT patronage.fold_body_save_distribution($1)', [{ payload: { distribution: '2040', snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text('distribution', '2040'), 'Folded')
})

test('a distributed surplus\'s body saved with another column beside it is refused, its id included', async () => {
  await refused(() => db.query(`UPDATE patronage.distribution SET body = $1, basis = 'equal' WHERE id = '2040'`, [body('x')]), /the 2040 surplus was distributed on 2041-03-01/)
  await refused(() => db.query(`UPDATE patronage.distribution SET body = $1, id = '2040b' WHERE id = '2040'`, [body('x')]), /the 2040 surplus was distributed on 2041-03-01/)
})

test('a distributed surplus distributed again on its day is refused, as on another: the guard fires by the columns an update sets, every one but the body', async () => {
  await refused(() => db.query(`UPDATE patronage.distribution SET distributed = '2041-03-01' WHERE id = '2040'`), /the 2040 surplus was distributed on 2041-03-01/)
  const { rows } = await db.query<{ unguarded: string[] }>(
    `SELECT coalesce(array_agg(a.attname::text ORDER BY a.attname), '{}') AS unguarded
     FROM pg_attribute a, pg_trigger t
     WHERE a.attrelid = 'patronage.distribution'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND t.tgrelid = a.attrelid AND t.tgname = 'stays_approved' AND NOT a.attnum = ANY (t.tgattr::int2[])`,
  )
  assert.deepEqual(rows[0].unguarded, ['body'], 'every column but the body fires stays_approved')
})
