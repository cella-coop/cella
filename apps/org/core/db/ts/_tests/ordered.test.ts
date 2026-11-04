// The field a collection's rows are ordered by first, alone: read from the
// order its one select lists in where that leads with a field by name, and
// none where an expression leads or extensions' rows follow the owner's.
// Run by `cella test slice db`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ordered } from '../src/read.ts'

const one = (order: string) => ({ rows: [{ sql: 'SELECT 1', order }], fields: [] })

test('an order leading with a field names it, ascending unless it says descending', () => {
  assert.deepEqual(ordered(one('name')), { key: 'name', dir: 'ascending' })
  assert.deepEqual(ordered(one('code ASC')), { key: 'code', dir: 'ascending' })
  assert.deepEqual(ordered(one('day DESC, id DESC')), { key: 'day', dir: 'descending' })
  assert.deepEqual(ordered(one('"from" DESC, adopted DESC, id')), { key: 'from', dir: 'descending' })
})

test('an expression leading the order, or rows of several selects, names none', () => {
  assert.equal(ordered(one('closed IS NOT NULL, proposed DESC, id DESC')), null)
  assert.equal(ordered(one("CASE kind WHEN 'a' THEN 0 END, title")), null)
  assert.equal(ordered({ rows: [{ sql: 'SELECT 1', order: 'name' }, { sql: 'SELECT 2', order: 'name' }], fields: [] }), null)
})
