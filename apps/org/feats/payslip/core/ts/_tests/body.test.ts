// A payslip's body, on a database holding only the app's core and this
// feat: saved after its run is approved, and saved again the same, its
// figures fixed all the while; refused with a figure beside it; and
// saved only by whoever reads the payslip, its member or a payroll
// power, never by any member of its circle alone. Run by `cella test
// slice payslip`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const chloe = 'chloe@body.example'
const julien = 'julien@body.example'
const amina = 'amina@body.example'
const id = `2041-01~${chloe}`

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const saved = async () => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM payslip.payslip WHERE id = $1', [id])).rows[0].text
const save = (snapshot: Buffer) => db.query('UPDATE payslip.payslip SET body = $2 WHERE id = $1', [id, snapshot])
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
  await db.query(`INSERT INTO payslip.run (month, generated) VALUES ('2041-01', '2041-02-01')`)
  await db.query(
    `INSERT INTO payslip.payslip (month, member, minutes, gross, employee, employer, net)
     VALUES ('2041-01', $1, 9000, cella.amount(300000), cella.amount(66000), cella.amount(120000), cella.amount(234000))`,
    [chloe],
  )
  await db.query(`UPDATE payslip.run SET approved = '2041-02-02', approver = $1 WHERE month = '2041-01'`, [julien])
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('an approved run\'s payslip takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('Overtime agreed with the circle')
  await save(first)
  assert.equal(await saved(), 'Overtime agreed with the circle')
  await save(first)
  assert.equal(await saved(), 'Overtime agreed with the circle', 'a save repeated changes nothing and is not refused')
  await db.query('SELECT payslip.fold_body_save($1)', [{ payload: { payslip: id, snapshot: body('Folded').toString('hex') } }])
  assert.equal(await saved(), 'Folded')
})

test('a body saved with a figure beside it is refused, as the figure alone is', async () => {
  await refused(
    () => db.query('UPDATE payslip.payslip SET body = $2, minutes = 1 WHERE id = $1', [id, body('And a figure')]),
    /the 2041-01 run is approved: its payslips never change/,
  )
  await refused(
    () => db.query(`UPDATE payslip.payslip SET body = $2, member = 'nobody@body.example' WHERE id = $1`, [id, body('And a key')]),
    /the 2041-01 run is approved: its payslips never change/,
  )
})

test('a body is saved by its member or a payroll power, never by a member of its circle alone', async () => {
  await db.query('CREATE SCHEMA bodied')
  await db.query(
    `CREATE FUNCTION bodied.may(actor text, power text, cents bigint, about text, day date) RETURNS boolean
     LANGUAGE sql STABLE RETURN actor = '${julien}' AND power = 'approve-payroll'`,
  )
  await db.query(
    `CREATE FUNCTION bodied.covered(actor text, power text, day date) RETURNS text[]
     LANGUAGE sql STABLE RETURN CASE WHEN bodied.may(actor, power, NULL, NULL, day) THEN ARRAY(SELECT id FROM circle.circle) ELSE '{}' END`,
  )
  await db.query(
    `INSERT INTO cella.authority (fn, covered, owner) VALUES ('bodied.may(text, text, bigint, text, date)', 'bodied.covered(text, text, date)', 'test')
     ON CONFLICT (one) DO UPDATE SET fn = excluded.fn, covered = excluded.covered, owner = excluded.owner`,
  )
  // As a write's transaction does, which sees every payslip, and as the
  // role guards run as: the guard asks the saver's own reading.
  await db.query(`SELECT set_config('cella.writing', 'on', true)`)
  const legible = async (actor: string) => {
    await db.query(`SELECT set_config('cella.actor', $1, true)`, [actor])
    await db.query('SET LOCAL ROLE cella_guards')
    try {
      return (await db.query<{ r: string | null }>('SELECT payslip.legible($1) AS r', [{ payslip: id }])).rows[0].r
    } finally {
      await db.query('RESET ROLE')
    }
  }
  assert.equal(await legible(chloe), null, 'her own')
  assert.equal(await legible(julien), null, 'whoever approves pay')
  assert.match((await legible(amina)) ?? '', /^a body's save is by someone who does not read this payslip of /)
  await db.query(`SELECT set_config('cella.actor', '', true), set_config('cella.writing', '', true)`)
})
