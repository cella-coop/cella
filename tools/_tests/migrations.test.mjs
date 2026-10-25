// Migrations are append-only by stable ids: an id names a migration by its
// app, its feat or graft and its file, wherever the feat sits in the tree,
// and the lock refuses an edited, removed or unlocked one.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatLock, idOf, parseLock, unlocked } from '../migrations.mjs'

test("a migration's id is its app, its owner and its file", () => {
  assert.equal(idOf('apps/org/core/sql/001-roles.sql'), 'org:core/001-roles.sql')
  assert.equal(idOf('apps/org/core/notary/sql/001-cella.sql'), 'org:core/notary/001-cella.sql')
  assert.equal(idOf('apps/org/feats/account/core/sql/001-account.sql'), 'org:account/001-account.sql')
  assert.equal(idOf('apps/org/feats/account/core/books/sql/001-books.sql'), 'org:account/books/001-books.sql')
  assert.equal(idOf('apps/org/grafts/account-transaction/sql/002-reach.sql'), 'org:account-transaction/002-reach.sql')
  assert.equal(idOf('apps/org/feats/person/grafts/employment-membership/sql/001-x.sql'), 'org:employment-membership/001-x.sql')
})

test('a feat that moves in the tree keeps its ids', () => {
  assert.equal(idOf('apps/org/feats/membership/core/sql/003-seats.sql'), idOf('apps/org/feats/person/feats/membership/core/sql/003-seats.sql'))
})

test('the lock refuses an edited, a removed and an unlocked migration', () => {
  const lock = parseLock(formatLock(new Map([['org:a/001-a.sql', 'h1'], ['org:a/002-b.sql', 'h2']])))
  assert.deepEqual([...lock.keys()], ['org:a/001-a.sql', 'org:a/002-b.sql'])
  const file = (n, hash) => ({ id: `org:a/${n}`, path: `apps/org/feats/a/core/sql/${n}`, hash })
  assert.deepEqual(unlocked(lock, [file('001-a.sql', 'h1'), file('002-b.sql', 'h2')]), [])
  const errors = unlocked(lock, [file('001-a.sql', 'edited'), file('003-c.sql', 'h3')])
  assert.equal(errors.length, 3)
  assert.match(errors[0], /001-a.sql changed after it was locked/)
  assert.match(errors[1], /003-c.sql is not locked/)
  assert.match(errors[2], /org:a\/002-b.sql is locked but gone/)
})
