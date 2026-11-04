// The collection's keyboard, alone: where j and k move its row over the
// rows drawn and the next page the server holds, and which one row is in
// the tab order as the keyboard roves them. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { step, stop } from '../src/models/keys.ts'

test('j from no row is on the first, and each move goes one row, held at the first and the last drawn', () => {
  assert.equal(step(-1, 1, 5, 0), 0)
  assert.equal(step(-1, -1, 5, 0), 0)
  assert.equal(step(0, 1, 5, 0), 1)
  assert.equal(step(1, 1, 5, 0), 2)
  assert.equal(step(2, -1, 5, 0), 1)
  assert.equal(step(0, -1, 5, 0), 0)
  assert.equal(step(4, 1, 5, 0), 4)
})

test('past the last drawn row, with more held, the row is the next page\'s first, and no further while it is asked for', () => {
  assert.equal(step(4, 1, 5, 3), 5)
  assert.equal(step(5, 1, 5, 3), 5)
  assert.equal(step(5, -1, 5, 3), 4)
  // Once the page is drawn, the row is its first.
  assert.equal(step(5, 1, 8, 0), 6)
})

test('the one row in the tab order is the keyboard\'s, the first before it is on one, the last drawn while the next page is asked for', () => {
  assert.equal(stop(-1, 5), 0)
  assert.equal(stop(2, 5), 2)
  assert.equal(stop(5, 5), 4)
  assert.equal(stop(5, 8), 5)
})
