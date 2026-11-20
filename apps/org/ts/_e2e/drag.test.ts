// Reordering by dragging, as the UI core's DragState drives it: what a
// lift, a move, a drop and a cancel do to a list. Pure: no browser.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancel, drop, idle, lifted, over, reorder, slot, start, step } from '@cella/org-ui/models'

test('a lifted item moves within its list and drops where it is carried', () => {
  let d = start('fields', 1, 4, 'keyboard')
  assert.ok(lifted(d))
  assert.deepEqual([d.from, d.to], [1, 1])
  d = step(d, 1)
  d = step(d, 1)
  assert.equal(d.to, 3)
  d = step(d, 1)
  assert.equal(d.to, 3, 'the last place holds it')
  d = over(d, -5)
  assert.equal(d.to, 0, 'the first place holds it')
  const done = drop(d)
  assert.deepEqual(done.move, { from: 1, to: 0 })
  assert.equal(lifted(done.drag), false)
})

test('a drop where it began moves nothing; a cancel moves nothing', () => {
  const d = step(step(start('views', 2, 5, 'pointer'), 1), -1)
  assert.equal(drop(d).move, null)
  assert.deepEqual(cancel(), idle())
  assert.equal(drop(idle()).move, null, 'nothing lifted drops nothing')
  assert.deepEqual(over(idle(), 3), idle(), 'nothing lifted moves nothing')
})

test('the indicator sits where the item will land', () => {
  assert.equal(slot(over(start('w', 1, 4, 'pointer'), 3)), 4, 'after the last when carried down to the end')
  assert.equal(slot(over(start('w', 3, 4, 'pointer'), 0)), 0, 'before the first when carried up to the top')
})

test('a move reorders a list of any item type, and the keyboard path lands as the pointer does', () => {
  const ws = [{ title: 'Owed' }, { title: 'Overdue' }, { title: 'By month' }]
  const keyboard = drop(step(step(start('fields', 0, 3, 'keyboard'), 1), 1)).move
  const pointer = drop(over(start('fields', 0, 3, 'pointer'), 2)).move
  assert.deepEqual(keyboard, pointer)
  assert.deepEqual(
    reorder(ws, keyboard!.from, keyboard!.to).map((w) => w.title),
    ['Overdue', 'By month', 'Owed'],
  )
  assert.deepEqual(reorder(['a', 'b'], 0, 5), ['a', 'b'], 'an index outside the list changes nothing')
})
