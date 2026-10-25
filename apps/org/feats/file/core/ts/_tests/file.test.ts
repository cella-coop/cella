// The files alone, on a database holding only the app's core and this
// feat: a file of the co-op's own uploaded through its write, named by the
// BLAKE3 of its bytes, which the log commits to; a file never changes and
// holds at most 10 MiB; who may open it by its own rule; what `file.stored`
// refuses; and a personal file's name and hash committed to, never logged.
// Run by `cella test slice file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { committed, content, file, upload } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@test.example'
const sofia = 'sofia@test.example'
const as: Deps = { db, actor: camille, sign: signer(scope, camille, fixture(camille, 'laptop')) }
const abc = new TextEncoder().encode('abc')

const refused = async (run: () => Promise<unknown>, says: RegExp) => {
  await db.query('BEGIN')
  try {
    await assert.rejects(run(), (e: Error) => {
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK')
  }
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  // Any device signs for anyone: this slice has no keyring of its own.
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
})

after(async () => {
  await db.end()
})

test('only the app\'s core and this feat are migrated', async () => {
  const { rows } = await db.query(`SELECT nspname FROM pg_namespace WHERE nspname IN ('membership', 'expense', 'expense_file')`)
  assert.deepEqual(rows, [])
})

test('a file of the co-op\'s own is named by the BLAKE3 of its bytes, which the log commits to', async () => {
  const out = await upload({ class: 'none', subject: null, name: 'statuts.txt', type: 'text/plain', bytes: abc }, as)
  assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
  const f = await file(db, 'fi-0001')
  // BLAKE3("abc"), the reference vector anyone can compute again.
  assert.equal(f?.hash, '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85')
  assert.deepEqual({ class: f?.class, subject: f?.subject, size: f?.size, uploader: f?.uploader, uploaded: f?.uploaded }, {
    class: 'none', subject: null, size: 3, uploader: camille, uploaded: '2026-10-24',
  })
  const { rows } = await db.query<{ form: Record<string, unknown> }>(`SELECT form FROM cella.log WHERE op = 'file:file:upload'`)
  assert.equal(rows[0].form.hash, f?.hash)
  assert.equal(rows[0].form.name, 'statuts.txt')
})

test('a file never changes, holds what its size says, and at most 10 MiB', async () => {
  await refused(() => db.query(`UPDATE file.file SET name = 'other.txt' WHERE id = 'fi-0001'`), /fi-0001 never changes once uploaded/)
  const insert = (size: number, bytes: Uint8Array | null) =>
    db.query(`INSERT INTO file.file (class, name, type, size, bytes, uploader, uploaded) VALUES ('none', 'x', 'text/plain', $1, $2, $3, '2026-10-24')`, [size, bytes, camille])
  await refused(() => insert(10 * 1024 * 1024 + 1, null), /file_size_check/)
  await refused(() => insert(4, abc), /file_check/)
  await refused(() => db.query(`INSERT INTO file.file (class, name, type, size, uploader, uploaded) VALUES ('payroll', 'x', 'text/plain', 1, $1, '2026-10-24')`, [camille]), /file_check/)
})

test('the co-op\'s own files open to anyone, a personal file to whom it concerns and who uploaded it', async () => {
  const { rows: added } = await db.query<{ id: string }>(
    `INSERT INTO file.file (class, subject, name, type, size, bytes, uploader, uploaded)
     VALUES ('expense-receipt', $1, 'ticket.png', 'image/png', 3, $2, $1, '2026-10-24'),
            ('payroll', $1, 'contrat.pdf', 'application/pdf', 3, $2, $3, '2026-10-24')
     RETURNING id`,
    [sofia, abc, camille],
  )
  const [receipt, contract] = added.map((r) => r.id)
  const opens = async (id: string, who: string | null) => (await content(db, id, who))?.open
  assert.equal(await opens('fi-0001', 'anyone@test.example'), true)
  assert.equal(await opens(receipt, sofia), true)
  assert.equal(await opens(receipt, camille), false)
  assert.equal(await opens(contract, sofia), true)
  assert.equal(await opens(contract, camille), true)
  assert.equal(await opens(contract, 'hugo@test.example'), false)
  assert.equal(await opens(contract, null), false)
  assert.equal(await content(db, 'fi-0009', camille), null)
  // The parts: each class's files sit in its own.
  const { rows } = await db.query(`SELECT tableoid::regclass::text AS part FROM file.file ORDER BY uploaded, class`)
  assert.deepEqual(rows.map((r) => r.part).sort(), ['file.contract', 'file.receipt', 'file.shared'])
})

test('file.stored says why a file is not the one a write stored', async () => {
  await db.query('BEGIN')
  try {
    const stored = async (id: string, cls: string, subject: string | null) =>
      (await db.query<{ r: string | null }>('SELECT file.stored($1, $2, $3) AS r', [id, cls, subject])).rows[0].r
    assert.match((await stored('fi-0009', 'none', null)) ?? '', /no file fi-0009/)
    // Outside a write, no one is acting, so no file was uploaded by it.
    assert.match((await stored('fi-0001', 'none', null)) ?? '', /fi-0001 was not uploaded by this write/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a personal file\'s name and hash are committed to, and the co-op\'s own are logged', () => {
  const stored = { file: 'fi-0002', class: 'expense-receipt' as const, subject: sofia, type: 'image/png', size: 3, hash: 'ab' }
  const logged = committed(stored, 'ticket.png')
  assert.deepEqual(logged.name, { $personal: { field: 'file.receipt.name', subject: sofia, value: 'ticket.png' } })
  assert.deepEqual(logged.hash, { $personal: { field: 'file.receipt.bytes', subject: sofia, value: 'ab' } })
  assert.equal(committed({ ...stored, class: 'none', subject: null }, 'statuts.txt').name, 'statuts.txt')
})
