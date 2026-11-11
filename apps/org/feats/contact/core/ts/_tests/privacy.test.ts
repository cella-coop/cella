// A person's data among the contacts, alone, on a database holding only the
// app's core and this feat: the log commits to each personal value under a
// fresh salt per field and write, the vault keeps the value and opens the
// commitment, the request's digest is salted too, and erasure deletes the
// salt and the value, redacts the read model, leaves the log verifying and
// wins over every later update. Run by `cella test slice contact`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { canonical, fixture, plain, signer } from '@cella/org-sign'
import { add, erase, update } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@test.example'
const as: Deps = { db, actor: camille, sign: signer(scope, camille, fixture(camille, 'laptop')) }

const settled = (out: { state: string; reason?: string; entry?: number }) => {
  assert.equal(out.state, 'settled', out.reason)
  return out.entry as number
}
const refusal = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const form = async (n: number) => (await db.query<{ form: Record<string, any> }>('SELECT form FROM cella.log WHERE n = $1', [n])).rows[0].form
const opened = async (n: number) => (await db.query<{ o: Record<string, any> }>('SELECT cella.opened($1) AS o', [n])).rows[0].o
const verifies = async () => (await db.query<{ v: boolean }>('SELECT cella.verify_log() AS v')).rows[0].v
const secrets = async (subject: string) => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM vault.secret WHERE subject = $1', [subject])).rows[0].n)

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  // Any device signs for anyone, in place of core person's keyring.
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query('DELETE FROM cella.keyring')
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
})

after(async () => {
  await db.end()
})

test('a person\'s email is committed to in the log, salted per write, and kept in the vault', async () => {
  const n = settled(await add({ id: 'ana', kind: 'person', name: 'Ana Martin', email: 'ana@example.org', tags: ['lead'] }, as))
  const logged = await form(n)
  assert.deepEqual(logged.fields, ['kind', 'name', 'email', 'tags'])
  assert.deepEqual(logged.values.kind, 'person')
  assert.deepEqual(logged.values.tags, ['lead'])
  assert.match(logged.values.email.$commit, /^[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(logged).includes('ana@example.org'))
  assert.ok(!JSON.stringify(logged).includes('Ana Martin'))
  assert.equal(await secrets('ana'), 2)

  // The same value written again commits to something else.
  const again = settled(await update({ id: 'ana', fields: { email: 'ana@example.org' } }, as))
  assert.notEqual((await form(again)).values.email.$commit, logged.values.email.$commit)
  assert.equal((await db.query(`SELECT count(DISTINCT salt) AS n FROM vault.secret WHERE subject = 'ana' AND field = 'contact.contact.email'`)).rows[0].n, '2')
})

test('the vault opens a commitment, and only with its own salt and value', async () => {
  const n = Number((await db.query(`SELECT max(n) AS n FROM cella.log WHERE op = 'contact:contact:add'`)).rows[0].n)
  const read = await opened(n)
  assert.equal(read.values.email, 'ana@example.org')
  assert.equal(read.values.name, 'Ana Martin')
  // Sealed bytes hold no plaintext.
  const { rows } = await db.query<{ sealed: Buffer }>(`SELECT sealed FROM vault.secret WHERE subject = 'ana'`)
  assert.ok(rows.every((r) => !r.sealed.toString('latin1').includes('ana@example.org')))
})

test('a receipt\'s request digest is salted, so it confirms no guess of the request', async () => {
  const request = plain({ id: 'ana', fields: { phone: '+33 6 12 34 56 78' } })
  const n = settled(await update({ id: 'ana', fields: { phone: '+33 6 12 34 56 78' } }, as))
  const { rows } = await db.query<{ request: Buffer }>('SELECT r.request FROM cella.receipt r JOIN cella.log l ON l.receipt = r.n WHERE l.n = $1', [n])
  const guessed = createHash('sha256').update(canonical(request)).digest()
  assert.notDeepEqual(rows[0].request, guessed)
})

test('erasing a person deletes their salts and values, redacts them, and the log still verifies', async () => {
  const added = Number((await db.query(`SELECT max(n) AS n FROM cella.log WHERE op = 'contact:contact:add'`)).rows[0].n)
  const n = settled(await erase({ id: 'ana' }, as))
  assert.deepEqual((await form(n)).erasure, { $erasure: { subject: 'ana', erased: ['contact'], restricted: [] } })
  assert.equal(await secrets('ana'), 0)
  assert.equal(Number((await db.query(`SELECT count(*) AS n FROM vault.key WHERE subject = 'ana'`)).rows[0].n), 0)
  const row = (await db.query('SELECT name, email, phone, archived FROM contact.contact WHERE id = $1', ['ana'])).rows[0]
  assert.deepEqual(row, { name: 'redacted', email: 'redacted', phone: 'redacted', archived: true })
  // The commitment no longer opens: the fold reads the gap as redacted.
  const read = await opened(added)
  assert.equal(read.values.email, 'redacted')
  assert.equal(read.values.kind, 'person')
  assert.equal(await verifies(), true)
})

test('erasure wins: a later value for the person is refused; a company is never erased', async () => {
  const head = Number((await db.query('SELECT n FROM cella.head')).rows[0].n)
  const late = await update({ id: 'ana', fields: { email: 'ana@new.example' } }, as)
  assert.match(refusal(late), /ana's contact data was erased at receipt \d+: erasure wins/)
  assert.equal(Number((await db.query('SELECT n FROM cella.head')).rows[0].n), head)
  settled(await add({ id: 'lumen', kind: 'company', name: 'Lumen SARL' }, as))
  assert.match(refusal(await erase({ id: 'lumen' }, as)), /lumen is a company: its data is not personal/)
  assert.equal((await db.query(`SELECT name FROM contact.contact WHERE id = 'lumen'`)).rows[0].name, 'Lumen SARL')
})
