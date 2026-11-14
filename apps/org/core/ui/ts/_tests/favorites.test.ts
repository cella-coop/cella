// A view across circles and the pins of Favorites, alone: `across` in a
// view's address and back, and the store a browser keeps read back, its
// pins kept where each is one, under its collection on this origin, and
// dropped otherwise. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { address, all, resolve, saved, spec } from '../src/models/query.ts'

test('a view reads across circles by `across` in its address, and none reads so by default', () => {
  const base = spec()
  assert.equal(base.across, false)
  const wide = { ...base, across: true }
  assert.equal(address('c-x', wide, base), '?v=c-x&across=1')
  assert.equal(resolve(new URLSearchParams('across=1'), [all], []).spec.across, true)
  assert.equal(resolve(new URLSearchParams('across=0'), [{ ...all, across: true }], []).spec.across, false)
  assert.equal(resolve(new URLSearchParams(''), [all], []).spec.across, false)
})

test('a store read back keeps its pins in order and drops what is not one', () => {
  const store = saved({
    v: 1,
    views: { tasks: [{ id: 'c-a', name: 'Ours', spec: { across: true } }] },
    pins: [
      { collection: 'tasks', view: 'c-a', name: 'Ours', icon: 'star', href: '/tasks?v=c-a&across=1' },
      { collection: 'tasks', view: 'all', name: 'Tasks', href: '/tasks?' },
      { collection: 'tasks', view: 'all', name: 'Elsewhere', href: 'https://example.org/tasks' },
      { collection: 'tasks', view: 'all', name: 'Another', href: '/invoices?' },
      { collection: 'tasks', name: 'No view', href: '/tasks' },
    ],
  })
  assert.deepEqual(store.pins.map((p) => p.name), ['Ours', 'Tasks'])
  assert.equal(store.views.tasks?.[0]?.spec.across, true)
  assert.deepEqual(saved({ v: 1, views: {} }).pins, [], 'a store from before pins reads as none pinned')
})
