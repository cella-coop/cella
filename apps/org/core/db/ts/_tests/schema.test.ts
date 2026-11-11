// A call's argument as a Standard Schema: an object of exactly the texts
// it names, each within its length, and each issue naming its key. Run by
// `cella test slice db`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { texts } from '../src/schema.ts'

const schema = texts(['name', 'search'], 8)
const check = (v: unknown) => schema['~standard'].validate(v)

test('an object of the texts named is its value', () => {
  assert.deepEqual(check({ name: 'tasks', search: '?n=60' }), { value: { name: 'tasks', search: '?n=60' } })
  assert.equal(schema['~standard'].version, 1)
})

test('a missing, long or unasked key is an issue at its path', () => {
  assert.deepEqual(check({ name: 'tasks' }), { issues: [{ message: 'search is a text', path: ['search'] }] })
  assert.deepEqual(check({ name: 'tasks', search: '?n=600000' }), { issues: [{ message: 'search is at most 8 characters', path: ['search'] }] })
  assert.deepEqual(check({ name: 'tasks', search: '', id: '1' }), { issues: [{ message: 'id is not asked for', path: ['id'] }] })
  assert.ok('issues' in check(null) && 'issues' in check(['tasks']) && 'issues' in check('tasks'))
})
