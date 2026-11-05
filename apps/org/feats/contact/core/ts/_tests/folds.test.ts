// The contact feat's folds (`sql/005-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// contact added with the fields its entry names, each personal one as its
// commitment, updated field by field, archived, and a person erased
// archived, their data redacted by the erasure the fold folds after it.
// Run by `cella test slice contact`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(64) })

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT contact.${fn}($1)`, [{ n, op, actor: sacha, date: '2041-02-03', cause: null, payload }])
const row = () => one(`SELECT kind, name, form, email, phone, address, parent, tags, note, client, archived FROM contact.contact WHERE id = 'folded-ana'`)

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO contact.contact (id, name) VALUES ('folded-mill', 'Folded Mill')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a contact folds added with the fields its entry names, each personal one as its commitment, then updated field by field', async () => {
  await fold('fold_add', 1, 'contact:contact:add', {
    contact: 'folded-ana',
    fields: ['kind', 'name', 'email', 'phone', 'parent', 'tags'],
    values: { kind: 'person', name: commitment('a'), email: commitment('b'), phone: null, parent: 'folded-mill', tags: ['lead'] },
  })
  assert.deepEqual(await row(), {
    kind: 'person', name: 'redacted', form: null, email: 'redacted', phone: null, address: null, parent: 'folded-mill', tags: ['lead'], note: '', client: null, archived: false,
  })
  await fold('fold_update', 2, 'contact:contact:update', {
    contact: 'folded-ana',
    fields: ['address', 'note', 'client'],
    values: { address: commitment('c'), note: commitment('d'), client: 'active' },
  })
  assert.deepEqual(await one(`SELECT address, note, client, email FROM contact.contact WHERE id = 'folded-ana'`), {
    address: 'redacted', note: 'redacted', client: 'active', email: 'redacted',
  })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE subject = 'folded-ana'`)).n, '4')
  await fold('fold_update', 3, 'contact:contact:archive', { contact: 'folded-ana', fields: ['archived'], values: { archived: true } })
  assert.deepEqual(await one(`SELECT archived FROM contact.contact WHERE id = 'folded-ana'`), { archived: true })
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold('fold_update', 4, 'contact:contact:update', { contact: 'folded-nobody', fields: ['client'], values: { client: 'lead' } }), /entry 4 sets the fields of folded-nobody, which the contacts do not hold/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})

test('a person folds erased: archived, and their data redacted by the erasure folded after', async () => {
  await db.query(`UPDATE contact.contact SET archived = false WHERE id = 'folded-ana'`)
  const payload = { contact: 'folded-ana', erasure: { $erasure: { subject: 'folded-ana', erased: ['contact'], restricted: [] } } }
  await fold('fold_erase', 5, 'contact:contact:erase', payload)
  await db.query(`SELECT cella.fold_erasures(5, $1)`, [payload])
  assert.deepEqual(await one(`SELECT archived FROM contact.contact WHERE id = 'folded-ana'`), { archived: true })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE subject = 'folded-ana'`)).n, '0')
})
