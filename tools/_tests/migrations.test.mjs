// Migrations go by stable ids: an id names a migration by its app, its feat
// or graft and its file, wherever the feat sits in the tree. Until launch a
// database that applied a file since edited is refused, with the words to
// reset it, and so is one that applied a file the tree no longer has.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edited, idOf } from '../migrations.mjs'

test("a migration's id is its app, its owner and its file", () => {
  assert.equal(idOf('apps/org/core/sql/001-roles.sql'), 'org:core/001-roles.sql')
  assert.equal(idOf('apps/org/core/notary/sql/001-cella.sql'), 'org:core/notary/001-cella.sql')
  assert.equal(idOf('apps/org/feats/account/core/sql/001-account.sql'), 'org:account/001-account.sql')
  assert.equal(idOf('apps/org/feats/account/core/books/sql/001-books.sql'), 'org:account/books/001-books.sql')
  assert.equal(idOf('apps/org/grafts/account-transaction/sql/002-reach.sql'), 'org:account-transaction/002-reach.sql')
  assert.equal(idOf('apps/org/feats/party/grafts/employment-membership/sql/001-x.sql'), 'org:employment-membership/001-x.sql')
  assert.equal(idOf('apps/org/core/person/sql/001-person.sql'), 'org:core/person/001-person.sql')
  assert.equal(idOf('apps/org/core/grafts/circle-person/sql/001-circle-person.sql'), 'org:circle-person/001-circle-person.sql')
})

test('a feat that moves in the tree keeps its ids', () => {
  assert.equal(idOf('apps/org/feats/membership/core/sql/003-seats.sql'), idOf('apps/org/feats/person/feats/membership/core/sql/003-seats.sql'))
})

test('a database that applied a file since edited is refused, with the words to reset it', () => {
  const applied = new Map([['org:a/001-a.sql', 'h1'], ['org:a/002-b.sql', 'h2']])
  const file = (n, hash) => ({ id: `org:a/${n}`, path: `apps/org/feats/a/core/sql/${n}`, hash })
  assert.deepEqual(edited(applied, [file('001-a.sql', 'h1'), file('002-b.sql', 'h2'), file('003-c.sql', 'h3')]), [])
  const errors = edited(applied, [file('001-a.sql', 'rewritten'), file('002-b.sql', 'h2'), file('003-c.sql', 'h3')])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /001-a\.sql \(org:a\/001-a\.sql\) was edited after this database applied it/)
  assert.match(errors[0], /`cella db reset`/)
})

test('a database that applied a file since gone or renamed is refused, unless only a slice is migrated', () => {
  const applied = new Map([['org:a/001-a.sql', 'h1'], ['org:motion/001-motion.sql', 'h2']])
  const files = [{ id: 'org:a/001-a.sql', path: 'apps/org/feats/a/core/sql/001-a.sql', hash: 'h1' }]
  const errors = edited(applied, files)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /org:motion\/001-motion\.sql was applied to this database and is gone from the tree/)
  assert.deepEqual(edited(applied, files, { whole: false }), [])
})
