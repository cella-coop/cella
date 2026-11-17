// A countdown's two spans, idle and lifetime, alone: the sooner of the
// two, and whether it warns. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearer, spoken, warns } from '../src/models/countdown.ts'

test('the sooner of the two spans shows, whichever it is', () => {
  assert.equal(nearer(90, 300), 90)
  assert.equal(nearer(300, 90), 90)
  assert.equal(nearer(90, null), 90)
  assert.equal(spoken(nearer(90, 300)), '0:01:30')
  assert.equal(spoken(nearer(300, 90)), '0:01:30')
})

test('only the idle span warns, and only where it is the nearer of the two', () => {
  // Idle is the sooner and within its last two minutes: it warns.
  assert.equal(warns(90, 300), true)
  // The lifetime is sooner, however little is left of it: no warning.
  assert.equal(warns(300, 90), false)
  // Idle is sooner but not yet within its last two minutes: no warning.
  assert.equal(warns(180, 300), false)
  // No lifetime running: idle warns on its own once close enough.
  assert.equal(warns(90, null), true)
  assert.equal(warns(180, null), false)
})
