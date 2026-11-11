// A person's data among the contacts, alone, on a database holding only the
// app's core and this feat: a person contact is a core person, brought in
// by address with the name, email and phone it gives, whose payload
// commits to them as core's; the log commits to each personal value under
// a fresh salt per field and write, the vault keeps the value and opens
// the commitment, the request's digest is salted too, and erasure deletes
// the salt and the value of the contact's data and of the core person's
// contact details, redacts the read models, leaves the log verifying and
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
const ana = 'ana@example.org'
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
const person = async () => (await db.query('SELECT name, email, phone FROM person.person WHERE address = $1', [ana])).rows[0]

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

test('a person contact is a core person, brought in by address, their details committed to in the log as core\'s', async () => {
  const n = settled(await add({ id: 'ana', kind: 'person', person: ana, name: 'Ana Martin', email: ana, tags: ['lead'] }, as))
  const logged = await form(n)
  assert.deepEqual(logged.fields, ['kind', 'tags', 'person'])
  assert.deepEqual(logged.values, { kind: 'person', tags: ['lead'], person: ana })
  assert.match(logged.entered.name.$commit, /^[0-9a-f]{64}$/)
  assert.match(logged.entered.email.$commit, /^[0-9a-f]{64}$/)
  assert.equal(logged.entered.phone, null)
  assert.ok(!JSON.stringify(logged).includes('Ana Martin'))
  assert.equal(await secrets(ana), 2)
  assert.deepEqual(await person(), { name: 'Ana Martin', email: ana, phone: null })
  assert.deepEqual((await db.query(`SELECT person, name, email FROM contact.contact WHERE id = 'ana'`)).rows[0], { person: ana, name: null, email: null })
  assert.deepEqual((await db.query(`SELECT name, email FROM contact.named WHERE id = 'ana'`)).rows[0], { name: 'Ana Martin', email: ana })
})

test('a person the co-op knows keeps their name, and the contact naming them commits to nothing of core\'s', async () => {
  const n = settled(await add({ id: 'ana-shop', kind: 'person', person: ana, name: 'Someone Else', email: 'else@example.org' }, as))
  assert.equal((await form(n)).entered, undefined)
  assert.deepEqual(await person(), { name: 'Ana Martin', email: ana, phone: null })
  assert.equal(await secrets(ana), 2)
})

test('a person contact\'s name, email and phone are core\'s: the contact changes none of them, and names a person', async () => {
  assert.match(refusal(await update({ id: 'ana', fields: { email: 'ana@new.example' } }, as)), /ana is a person: their name, email and phone are core person's/)
  assert.match(refusal(await add({ id: 'nobody', kind: 'person', name: 'No One' }, as)), /nobody is a person contact naming no person/)
})

test('a contact\'s own personal value is salted per write, and the vault opens it with its own salt alone', async () => {
  const first = settled(await update({ id: 'ana', fields: { note: 'prefers mornings' } }, as))
  const again = settled(await update({ id: 'ana', fields: { note: 'prefers mornings' } }, as))
  assert.notEqual((await form(again)).values.note.$commit, (await form(first)).values.note.$commit)
  assert.equal((await db.query(`SELECT count(DISTINCT salt) AS n FROM vault.secret WHERE subject = 'ana' AND field = 'contact.contact.note'`)).rows[0].n, '2')
  assert.equal((await opened(first)).values.note, 'prefers mornings')
  const added = Number((await db.query(`SELECT min(n) AS n FROM cella.log WHERE op = 'contact:contact:add'`)).rows[0].n)
  assert.equal((await opened(added)).entered.email, ana)
  // Sealed bytes hold no plaintext.
  const { rows } = await db.query<{ sealed: Buffer }>(`SELECT sealed FROM vault.secret WHERE subject IN ('ana', $1)`, [ana])
  assert.ok(rows.every((r) => !r.sealed.toString('latin1').includes('prefers mornings') && !r.sealed.toString('latin1').includes(ana)))
})

test('a receipt\'s request digest is salted, so it confirms no guess of the request', async () => {
  const request = plain({ id: 'ana', fields: { note: 'call after ten' } })
  const n = settled(await update({ id: 'ana', fields: { note: 'call after ten' } }, as))
  const { rows } = await db.query<{ request: Buffer }>('SELECT r.request FROM cella.receipt r JOIN cella.log l ON l.receipt = r.n WHERE l.n = $1', [n])
  const guessed = createHash('sha256').update(canonical(request)).digest()
  assert.notDeepEqual(rows[0].request, guessed)
})

test('erasing a person contact erases their contact data and their core person\'s contact details, and the log still verifies', async () => {
  const added = Number((await db.query(`SELECT min(n) AS n FROM cella.log WHERE op = 'contact:contact:add'`)).rows[0].n)
  const n = settled(await erase({ id: 'ana' }, as))
  const logged = await form(n)
  assert.deepEqual(logged.erasure, { $erasure: { subject: 'ana', erased: ['contact'], restricted: [] } })
  assert.deepEqual(logged.details, { $erasure: { subject: ana, erased: ['contact'], restricted: [] } })
  assert.equal(await secrets('ana'), 0)
  // Their name is of class profile, which a contact's erasure leaves.
  assert.equal(await secrets(ana), 1)
  assert.deepEqual(await person(), { name: 'Ana Martin', email: 'redacted', phone: null })
  const row = (await db.query('SELECT note, archived FROM contact.contact WHERE id = $1', ['ana'])).rows[0]
  assert.deepEqual(row, { note: 'redacted', archived: true })
  // The commitment no longer opens: the fold reads the gap as redacted.
  const read = await opened(added)
  assert.equal(read.entered.email, 'redacted')
  assert.equal(read.values.kind, 'person')
  assert.equal(await verifies(), true)
})

test('erasure wins: a later value for the person is refused; a company is never erased', async () => {
  const head = Number((await db.query('SELECT n FROM cella.head')).rows[0].n)
  const late = await update({ id: 'ana', fields: { note: 'back again' } }, as)
  assert.match(refusal(late), /ana's contact data was erased at receipt \d+: erasure wins/)
  assert.equal(Number((await db.query('SELECT n FROM cella.head')).rows[0].n), head)
  settled(await add({ id: 'lumen', kind: 'company', name: 'Lumen SARL' }, as))
  assert.match(refusal(await erase({ id: 'lumen' }, as)), /lumen is a company: its data is not personal/)
  assert.equal((await db.query(`SELECT name FROM contact.contact WHERE id = 'lumen'`)).rows[0].name, 'Lumen SARL')
})
