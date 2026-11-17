// A file's body, on a database holding only the app's core and this feat:
// saved on a file that never changes, saved again the same and folded,
// the file fixed all the while; refused with another column beside it,
// its id included; updated, on the app's role, in a write's transaction,
// which sees every file, and outside one only on a file its reader reads;
// and saved only by whoever reads the file. Run by `cella test slice
// file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createDoc, edits } from '@cella/org-body/models'

const db = new pg.Client()
const camille = 'camille@body.example'
const sofia = 'sofia@body.example'
const abc = new TextEncoder().encode('abc')

const body = (text: string) => {
  const doc = createDoc(7n)
  edits.paste(doc, undefined, 0, [{ type: 'paragraph', runs: [{ text }], children: [] }])
  doc.commit()
  return Buffer.from(doc.export({ mode: 'snapshot' }))
}
const text = async (id: string) => (await db.query<{ text: string | null }>('SELECT cella.document_text(body) AS text FROM file.file WHERE id = $1', [id])).rows[0].text
const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('SAVEPOINT refused')
  try {
    await assert.rejects(run(), (e: Error) => (assert.match(e.message, says), true))
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT refused')
  }
}
// As the app's role reads and writes, for `actor`, in a write's
// transaction or not, and as the role guards run as.
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
  const add = (id: string, cls: string, subject: string | null) =>
    db.query(
      `INSERT INTO file.file (id, class, subject, name, type, size, bytes, uploader, uploaded) VALUES ($1, $2, $3, 'x.pdf', 'application/pdf', 3, $4, $5, '2041-01-10')`,
      [id, cls, subject, abc, camille],
    )
  await add('fi-body1', 'none', null)
  await add('fi-body2', 'payroll', sofia)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a file takes its body, saved again the same, and folded from its entry', async () => {
  const first = body('The signed copy')
  await db.query(`UPDATE file.file SET body = $1 WHERE id = 'fi-body1'`, [first])
  await db.query(`UPDATE file.file SET body = $1 WHERE id = 'fi-body1'`, [first])
  assert.equal(await text('fi-body1'), 'The signed copy')
  await db.query('SELECT file.fold_body_save($1)', [{ payload: { file: 'fi-body1', snapshot: body('Folded').toString('hex') } }])
  assert.equal(await text('fi-body1'), 'Folded')
})

test('a file\'s body saved with another column beside it is refused, its id included', async () => {
  await refused(() => db.query(`UPDATE file.file SET body = $1, name = 'y.pdf' WHERE id = 'fi-body1'`, [body('x')]), /fi-body1 never changes once uploaded/)
  await refused(() => db.query(`UPDATE file.file SET body = $1, id = 'fi-body9' WHERE id = 'fi-body1'`, [body('x')]), /fi-body1 never changes once uploaded/)
})

test('on the app\'s role, a write\'s transaction updates any file\'s body, and none outside one but a file its reader reads', async () => {
  const update = (id: string) => db.query(`UPDATE file.file SET body = $2 WHERE id = $1 RETURNING id`, [id, body('Updated')])
  assert.equal((await as('cella_app', camille, true, () => update('fi-body2'))).rowCount, 1, 'a write sees every file')
  assert.equal((await as('cella_app', 'nobody@body.example', false, () => update('fi-body2'))).rowCount, 0, 'one who does not read a payroll file updates none')
  assert.equal(await text('fi-body2'), 'Updated')
})

test('a personal file\'s body is saved by whoever reads it, never by a member of its circle alone', async () => {
  const legible = (actor: string, file: string) =>
    as('cella_guards', actor, true, async () => (await db.query<{ r: string | null }>('SELECT file.legible($1) AS r', [{ file }])).rows[0].r)
  assert.equal(await legible(sofia, 'fi-body2'), null, 'the person it concerns')
  assert.equal(await legible(camille, 'fi-body2'), null, 'who uploaded it')
  assert.match((await legible('nobody@body.example', 'fi-body2')) ?? '', /^a body's save is by someone who does not read this file of /)
})
