// A `Repeat`'s rows: added at the end, removed by index, and moved to
// reorder, each leaving the rest in their order. Run by `cella test
// slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { added, moved, removed } from '../src/models/repeat.ts'

test('added appends a fresh row, made only once', () => {
  let made = 0
  const make = () => ({ n: ++made })
  assert.deepEqual(added([], make), [{ n: 1 }])
  assert.deepEqual(added([{ n: 1 }], make), [{ n: 1 }, { n: 2 }])
  assert.equal(made, 2, 'make is called once a row')
})

test('removed drops the row at its index, the rest keeping their place', () => {
  assert.deepEqual(removed(['a', 'b', 'c'], 1), ['a', 'c'])
  assert.deepEqual(removed(['a'], 0), [])
  assert.deepEqual(removed(['a', 'b'], 5), ['a', 'b'], 'an index past the end changes nothing')
})

test('moved reorders a row, the rest keeping theirs', () => {
  assert.deepEqual(moved(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a'])
  assert.deepEqual(moved(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(moved(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c'], 'from and to alike, nothing moves')
  assert.deepEqual(moved(['a', 'b'], -1, 1), ['a', 'b'], 'an index out of range changes nothing')
  assert.deepEqual(moved(['a', 'b'], 0, 5), ['a', 'b'])
})
