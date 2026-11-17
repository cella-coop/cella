// The bodies of the books, on a database holding only the app's core and
// this feat: a closed period's and adopted capital terms' saved, saved
// again the same and folded, what closed or was adopted fixed all the
// while; refused with another column beside it, a key included; and a
// capital account's saved only by whoever reads it, its holder or a
// power that keeps the books, never by any member of its circle alone.
// Run by `cella test slice account`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const camille = 'camille@body.example'
const chloe = 'chloe@body.example'
const julien = 'julien@body.example'

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async (table: string, key: string, id: string) =>
  (await db.query<{ text: string | null }>(`SELECT cella.document_text(body) AS text FROM account.${table} WHERE ${key} = $1`, [id])).rows[0].text
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
  await db.query(`SET LOCAL cella.clock = '2041-02-05'`)
  await db.query(`INSERT INTO account.period (month) VALUES ('2041-01')`)
  await db.query(`UPDATE account.period SET closed = '2041-02-05' WHERE month = '2041-01'`)
  await db.query(
    `INSERT INTO account.terms (id, policy, "from", share, minimum, instalments, delay, repayments, adopted)
     VALUES ('ct-body', 'ct-body', '2041-01-01', cella.amount(5000), 1, 1, 0, 1, '2041-01-01')`,
  )
  await db.query(
    `INSERT INTO account.account (code, label, kind, parent, holder) VALUES
       ('9013', 'Capital', 'equity', NULL, NULL),
       ('901301', 'Capital — Chloé', 'equity', '9013', $1)`,
    [chloe],
  )
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a closed period takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('Closed after the audit')
  await db.query(`UPDATE account.period SET body = $1 WHERE month = '2041-01'`, [first])
  await db.query(`UPDATE account.period SET body = $1 WHERE month = '2041-01'`, [first])
  assert.equal(await text('period', 'month', '2041-01'), 'Closed after the audit')
  await db.query('SELECT account.fold_body_save_period($1)', [{ payload: { period: '2041-01', snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text('period', 'month', '2041-01'), 'Folded')
})

test('a closed period\'s body saved with another column beside it is refused, its month included', async () => {
  await refused(() => db.query(`UPDATE account.period SET body = $1, closed = '2041-02-06' WHERE month = '2041-01'`, [body('x')]), /2041-01 closed on 2041-02-05/)
  await refused(() => db.query(`UPDATE account.period SET body = $1, month = '2041-03' WHERE month = '2041-01'`, [body('x')]), /2041-01 closed on 2041-02-05/)
})

test('adopted terms take their body, saved again the same, and folded from its entry', async () => {
  const first = body('Why fifty euros a share')
  await db.query(`UPDATE account.terms SET body = $1 WHERE id = 'ct-body'`, [first])
  await db.query(`UPDATE account.terms SET body = $1 WHERE id = 'ct-body'`, [first])
  assert.equal(await text('terms', 'id', 'ct-body'), 'Why fifty euros a share')
  await db.query('SELECT account.fold_body_save_terms($1)', [{ payload: { terms: 'ct-body', snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text('terms', 'id', 'ct-body'), 'Folded')
})

test('adopted terms\' body saved with another column beside it is refused, their id included', async () => {
  await refused(() => db.query(`UPDATE account.terms SET body = $1, minimum = 2 WHERE id = 'ct-body'`, [body('x')]), /ct-body were adopted on/)
  await refused(() => db.query(`UPDATE account.terms SET body = $1, id = 'ct-other' WHERE id = 'ct-body'`, [body('x')]), /ct-body were adopted on/)
})

test('a capital account\'s body is saved by its holder or whoever keeps the books, never by a member of its circle alone', async () => {
  await db.query('CREATE SCHEMA bodied')
  await db.query(
    `CREATE FUNCTION bodied.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${julien}' AND power = 'carry-books'`,
  )
  await db.query(
    `CREATE FUNCTION bodied.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN power = 'read' OR bodied.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(
    `INSERT INTO cella.authority (fn, covered, owner) VALUES ('bodied.may(text, text, bigint, text, date)', 'bodied.covered(text, text, date)', 'test')
     ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`,
  )
  // As a write's transaction does, which sees every account, and as the
  // role guards run as: the guard asks the saver's own reading.
  await db.query(`SELECT set_config('cella.writing', 'on', true)`)
  const legible = async (actor: string, account: string) => {
    await db.query(`SELECT set_config('cella.actor', $1, true)`, [actor])
    await db.query('SET LOCAL ROLE cella_guards')
    try {
      return (await db.query<{ r: string | null }>('SELECT account.legible_account($1) AS r', [{ account }])).rows[0].r
    } finally {
      await db.query('RESET ROLE')
    }
  }
  assert.equal(await legible(chloe, '901301'), null, 'her own')
  assert.equal(await legible(julien, '901301'), null, 'whoever keeps the books')
  assert.match((await legible(camille, '901301')) ?? '', /^a body's save is by someone who does not read this account of /)
  assert.equal(await legible(camille, '9013'), null, 'an account that is no one\'s, by whoever reads its circle')
  await db.query(`SELECT set_config('cella.actor', '', true), set_config('cella.writing', '', true)`)
})

test('a closed period closed again on its day is refused: the trigger fires by the columns an update sets, every one but the body', async () => {
  await refused(() => db.query(`UPDATE account.period SET closed = '2041-02-05' WHERE month = '2041-01'`), /2041-01 closed on 2041-02-05/)
  const { rows } = await db.query<{ unguarded: string[] }>(
    `SELECT coalesce(array_agg(a.attname::text ORDER BY a.attname), '{}') AS unguarded
     FROM pg_attribute a, pg_trigger t
     WHERE a.attrelid = 'account.period'::regclass AND a.attnum > 0 AND NOT a.attisdropped
       AND t.tgrelid = a.attrelid AND t.tgname = 'stays_closed' AND NOT a.attnum = ANY (t.tgattr::int2[])`,
  )
  assert.deepEqual(rows[0].unguarded, ['body'], 'every column but the body fires stays_closed')
})
