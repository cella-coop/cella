// The contact feat's folds (`sql/005-folds.sql`), on a database holding
// the app's core and this feat, in a transaction rolled back after: a
// company added with the fields its entry names, each personal one as its
// commitment, updated field by field and archived; a person contact
// added by address, whom core person's fold enters by the commitments the
// entry carries; and a person erased archived, their data redacted by the
// erasures the fold folds after it. Run by `cella test slice contact`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const sacha = 'sacha@folded.example'
const ana = 'ana@folded.example'
const commitment = (c: string) => ({ $commit: c.repeat(64) })

const one = async <R>(sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] as R
const fold = (fn: string, n: number, op: string, payload: unknown) =>
  db.query(`SELECT ${fn}($1)`, [{ n, op, actor: sacha, date: '2041-02-03', cause: null, payload }])
const row = () => one(`SELECT kind, person, name, form, email, phone, address, parent, tags, note, client, archived FROM contact.contact WHERE id = 'folded-ana'`)

before(async () => {
  await db.connect()
  await db.query('BEGIN')
  await db.query(`INSERT INTO contact.contact (id, name) VALUES ('folded-mill', 'Folded Mill')`)
})

after(async () => {
  await db.query('ROLLBACK')
  await db.end()
})

test('a company folds added with the fields its entry names, each personal one as its commitment, then updated field by field', async () => {
  await fold('contact.fold_add', 1, 'contact:contact:add', {
    contact: 'folded-press',
    fields: ['kind', 'name', 'email', 'phone', 'tags'],
    values: { kind: 'company', name: commitment('a'), email: commitment('b'), phone: null, tags: ['print'] },
  })
  assert.deepEqual(await one(`SELECT kind, person, name, email, phone, tags FROM contact.contact WHERE id = 'folded-press'`), {
    kind: 'company', person: null, name: 'redacted', email: 'redacted', phone: null, tags: ['print'],
  })
  await fold('contact.fold_update', 2, 'contact:contact:update', {
    contact: 'folded-press',
    fields: ['address', 'note', 'client'],
    values: { address: commitment('c'), note: commitment('d'), client: 'active' },
  })
  assert.deepEqual(await one(`SELECT address, note, client, email FROM contact.contact WHERE id = 'folded-press'`), {
    address: 'redacted', note: 'redacted', client: 'active', email: 'redacted',
  })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE subject = 'folded-press'`)).n, '4')
  await fold('contact.fold_update', 3, 'contact:contact:archive', { contact: 'folded-press', fields: ['archived'], values: { archived: true } })
  assert.deepEqual(await one(`SELECT archived FROM contact.contact WHERE id = 'folded-press'`), { archived: true })
  await db.query('SAVEPOINT refused')
  await assert.rejects(fold('contact.fold_update', 4, 'contact:contact:update', { contact: 'folded-nobody', fields: ['client'], values: { client: 'lead' } }), /entry 4 sets the fields of folded-nobody, which the contacts do not hold/)
  await db.query('ROLLBACK TO SAVEPOINT refused')
})

test('a person contact folds added by address, and core person enters them by the commitments the entry carries', async () => {
  const payload = {
    contact: 'folded-ana',
    fields: ['kind', 'parent', 'tags', 'person'],
    values: { kind: 'person', parent: 'folded-mill', tags: ['lead'], person: ana },
    entered: { name: commitment('e'), email: commitment('f'), phone: null },
  }
  await fold('contact.fold_add', 5, 'contact:contact:add', payload)
  await fold('person.fold_contact', 5, 'contact:contact:add', payload)
  assert.deepEqual(await row(), {
    kind: 'person', person: ana, name: null, form: null, email: null, phone: null, address: null, parent: 'folded-mill', tags: ['lead'], note: '', client: null, archived: false,
  })
  assert.deepEqual(await one('SELECT name, email, phone FROM person.person WHERE address = $1', [ana]), { name: 'redacted', email: 'redacted', phone: null })
  // A contact naming a person the scope knew carries nothing to enter.
  await fold('person.fold_contact', 6, 'contact:contact:add', { contact: 'folded-ana-again', fields: ['kind', 'person'], values: { kind: 'person', person: ana } })
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM person.person WHERE address = $1', [ana])).n, '1')
  await fold('contact.fold_update', 7, 'contact:contact:update', { contact: 'folded-ana', fields: ['note'], values: { note: commitment('9') } })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE subject = 'folded-ana'`)).n, '1')
})

test('a person folds erased: archived, their data and their core person\'s contact details redacted by the erasures folded after', async () => {
  const payload = {
    contact: 'folded-ana',
    erasure: { $erasure: { subject: 'folded-ana', erased: ['contact'], restricted: [] } },
    details: { $erasure: { subject: ana, erased: ['contact'], restricted: [] } },
  }
  await fold('contact.fold_erase', 8, 'contact:contact:erase', payload)
  await db.query(`SELECT cella.fold_erasures(8, $1)`, [payload])
  assert.deepEqual(await one(`SELECT archived, note FROM contact.contact WHERE id = 'folded-ana'`), { archived: true, note: 'redacted' })
  assert.equal((await one<{ n: string }>(`SELECT count(*) AS n FROM cella.commitment WHERE subject = 'folded-ana'`)).n, '0')
  // The name is of class profile, which a contact's erasure leaves.
  assert.deepEqual(
    (await db.query(`SELECT field FROM cella.commitment WHERE subject = $1 ORDER BY field`, [ana])).rows.map((r) => r.field),
    ['person.person.name'],
  )
})
