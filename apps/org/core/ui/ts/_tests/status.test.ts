// The status kind, alone: a state's tone is its category's unless its
// own, a started state's circle fills by its place among the started
// ones, and what is open never names a value. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { finished, open, stage, toneOf, values, within, type Lifecycle } from '../src/models/status.ts'
import { declared, fields, lanes } from '../src/models/query.ts'

const task: Lifecycle = {
  column: 'task.status',
  states: [
    { value: 'backlog', category: 'backlog' },
    { value: 'next', category: 'unstarted' },
    { value: 'active', category: 'started' },
    { value: 'review', category: 'started' },
    { value: 'done', category: 'completed' },
    { value: 'refused', category: 'cancelled', tone: 'negative' },
  ],
}

test("a state's tone is its category's, else its own; one not listed is neutral", () => {
  assert.deepEqual(values(task).map((v) => toneOf(task, v)), ['neutral', 'neutral', 'accent', 'accent', 'positive', 'negative'])
  assert.equal(toneOf(task, 'lost'), 'neutral')
})

test("a started state's circle fills by its place among the started ones", () => {
  assert.deepEqual(['active', 'review'].map((v) => stage(task, v)?.fill), [1 / 3, 2 / 3])
  assert.equal(stage(task, 'done')?.fill, 0)
  assert.equal(stage(task, 'lost'), undefined)
})

test('what is open, settled or in a category is read by category', () => {
  assert.deepEqual(open(task), ['backlog', 'next', 'active', 'review'])
  assert.deepEqual(within(task, 'completed', 'cancelled'), ['done', 'refused'])
  assert.deepEqual([finished('completed'), finished('cancelled'), finished('started')], [true, true, false])
})

test("a status's columns and groups follow its lifecycle where the look declares none", () => {
  const [f] = fields([{ key: 'status', label: 'Status', kind: 'status', states: task, value: (r) => r.status }])
  assert.equal(f.type, 'enum')
  assert.deepEqual(declared({}, 'status', f.states), values(task))
  assert.deepEqual(declared({ lanes: { status: ['done'] } }, 'status', f.states), ['done'])
  assert.deepEqual(lanes({}, 'status', ['odd', 'next'], f.states), [...values(task), 'odd'])
})
