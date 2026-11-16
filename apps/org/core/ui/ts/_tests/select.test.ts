// A select's keyboard, alone: the options the arrows, Home and End reach
// past disabled ones, those typing reaches, and the runs under their
// headings. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { edge, grouped, moved, typedTo, type Option } from '../src/models/select.ts'

const o = (label: string, more: Partial<Option> = {}): Option => ({ value: label.toLowerCase(), label, ...more })
const options = [o('Started'), o('Due', { disabled: true }), o('Done'), o('Owner'), o('Open'), o('Circle', { disabled: true })]

test('the arrows move one option past disabled ones, held at the ends', () => {
  assert.equal(moved(options, 0, 1), 2, 'Due is passed over')
  assert.equal(moved(options, 2, -1), 0)
  assert.equal(moved(options, 4, 1), 4, 'held at the last that may be chosen')
  assert.equal(moved(options, 0, -1), 0, 'held at the first')
  assert.equal(moved(options, -1, 1), 0, 'from nothing, down is the first')
  assert.equal(moved(options, -1, -1), 4, 'from nothing, up is the last that may be chosen')
  assert.equal(moved(options, 0, 10), 4, 'a page down stops at the last')
  assert.equal(moved([o('A', { disabled: true })], -1, 1), -1, 'nothing to choose, nothing reached')
})

test('Home and End reach the first and last option that may be chosen', () => {
  assert.equal(edge(options, 'first'), 0)
  assert.equal(edge(options, 'last'), 4)
})

test('typing reaches the next option its letters start, and a letter again cycles them', () => {
  assert.equal(typedTo(options, 0, 'd'), 2, 'Done, Due being disabled')
  assert.equal(typedTo(options, 0, 'o'), 3)
  assert.equal(typedTo(options, 3, 'o'), 4, 'o again goes on to Open')
  assert.equal(typedTo(options, 4, 'oo'), 3, 'a letter typed twice cycles, wrapping')
  assert.equal(typedTo(options, 3, 'op'), 4, 'a longer run reaches what it starts')
  assert.equal(typedTo(options, 3, 'ow'), 3, 'and stays where it still matches')
  assert.equal(typedTo(options, 0, 'x'), 0, 'nothing it starts, nothing moves')
  assert.equal(typedTo(options, 0, 'c'), 0, 'a disabled option is never reached')
})

test('options sit in runs under their headings, each with its place in the list', () => {
  const g = grouped([o('None'), o('Status', { group: 'Fields' }), o('Owner', { group: 'Fields' }), o('Created', { group: 'Logged' })])
  assert.deepEqual(
    g.map((r) => [r.label, r.options.map((x) => x.at)]),
    [
      [null, [0]],
      ['Fields', [1, 2]],
      ['Logged', [3]],
    ],
  )
})
