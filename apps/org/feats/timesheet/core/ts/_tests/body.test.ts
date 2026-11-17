// A timesheet entry's body, on a database holding only the app's core and
// this feat: saved after its month is approved, saved again the same and
// folded, its time fixed all the while; refused with another column
// beside it, its id included; and saved only by whoever reads the entry,
// its member or a power that reads time, never by any member of its
// circle alone. Run by `cella test slice timesheet`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const lea = 'lea@body.example'
const yusuf = 'yusuf@body.example'
let id = ''

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async () => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM timesheet.entry WHERE id = $1', [id])).rows[0].text
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
  await db.query(`SET LOCAL cella.clock = '2041-02-02'`)
  const { rows } = await db.query<{ id: string }>(`INSERT INTO timesheet.entry (id, member, day, minutes, billable) VALUES (9001, $1, '2041-01-15', 420, true) RETURNING id`, [lea])
  id = rows[0].id
  await db.query(`UPDATE timesheet.period SET submitted = '2041-01-31' WHERE member = $1 AND month = '2041-01'`, [lea])
  await db.query(`UPDATE timesheet.period SET approved = '2041-02-02', approver = $2 WHERE member = $1 AND month = '2041-01'`, [lea, yusuf])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an approved month\'s entry takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('The client call ran long')
  await db.query('UPDATE timesheet.entry SET body = $2 WHERE id = $1', [id, first])
  await db.query('UPDATE timesheet.entry SET body = $2 WHERE id = $1', [id, first])
  assert.equal(await text(), 'The client call ran long')
  await db.query('SELECT timesheet.fold_body_save($1)', [{ payload: { timesheet: id, snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text(), 'Folded')
})

test('an approved month\'s entry\'s body saved with another column beside it is refused, its id included', async () => {
  await refused(() => db.query('UPDATE timesheet.entry SET body = $2, minutes = 60 WHERE id = $1', [id, body('x')]), / was approved on 2041-02-02: its entries stand/)
  await refused(() => db.query(`UPDATE timesheet.entry SET body = $2, note = 'x' WHERE id = $1`, [id, body('x')]), /is corrected only by lowering its time/)
  await refused(() => db.query('UPDATE timesheet.entry SET body = $2, id = id + 1000 WHERE id = $1', [id, body('x')]), /is corrected only by lowering its time/)
})

test('an entry\'s body is saved by its member or a power that reads time, never by a member of its circle alone', async () => {
  await db.query('CREATE SCHEMA bodied')
  await db.query(
    `CREATE FUNCTION bodied.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${yusuf}' AND power = 'approve-time'`,
  )
  await db.query(
    `CREATE FUNCTION bodied.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN bodied.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(
    `INSERT INTO cella.authority (fn, covered, owner) VALUES ('bodied.may(text, text, bigint, text, date)', 'bodied.covered(text, text, date)', 'test')
     ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`,
  )
  // As a write's transaction does, which sees every entry, and as the
  // role guards run as: the guard asks the saver's own reading.
  const legible = async (actor: string) => {
    await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', 'on', true)`, [actor])
    await db.query('SET LOCAL ROLE cella_guards')
    try {
      return (await db.query<{ r: string | null }>('SELECT timesheet.legible($1) AS r', [{ timesheet: id }])).rows[0].r
    } finally {
      await db.query('RESET ROLE')
      await db.query(`SELECT set_config('cella.actor', '', true), set_config('cella.writing', '', true)`)
    }
  }
  assert.equal(await legible(lea), null, 'her own')
  assert.equal(await legible(yusuf), null, 'whoever approves time')
  assert.match((await legible('camille@body.example')) ?? '', /^a body's save is by someone who does not read this timesheet entry of /)
})
