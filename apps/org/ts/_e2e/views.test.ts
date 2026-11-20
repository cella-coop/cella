// A view's configuration, checked against a collection's declared fields
// before the server runs it, and a view in the retired dashboard opening
// in its collection's own layout. Pure: no database, no server, though
// `cella test e2e` gives it both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fields, filtering, limits, resolve, saved, where, writable, type Look } from '@cella/org-ui/models'

const fs = fields([
  { key: 'id', label: 'Invoice', kind: 'title', value: (r: any) => r.id },
  { key: 'state', label: 'Standing', kind: 'badge', value: (r: any) => r.state },
  { key: 'issued', label: 'Issued', kind: 'date', value: (r: any) => r.issued },
  { key: 'total', label: 'Total', kind: 'money', value: (r: any) => r.total },
  { key: 'owed', label: 'Owed', kind: 'money', value: (r: any) => r.owed },
])

test('the fields are typed from the columns', () => {
  assert.deepEqual(
    fs.map((f) => [f.key, f.type]),
    [['id', 'text'], ['state', 'enum'], ['issued', 'date'], ['total', 'money'], ['owed', 'money']],
  )
})

test('a person and a circle are fields of their own type, and a condition keeps any field among some values', () => {
  const people = fields([
    { key: 'by', label: 'By', kind: 'person', value: (r: any) => r.by },
    { key: 'circle', label: 'Circle', kind: 'circle', value: (r: any) => r.circle },
    { key: 'total', label: 'Total', kind: 'money', value: (r: any) => r.total },
    { key: 'note', label: 'Note', value: (r: any) => r.note },
  ])
  assert.deepEqual(people.map((f) => f.type), ['person', 'circle', 'money', 'text'])
  for (const w of [{ field: 'by', is: ['julien@lanterne.example'] }, { field: 'circle', is: ['web', 'coordination'] }, { field: 'total', is: ['1200'] }, { field: 'note', is: ['late'] }]) {
    assert.deepEqual(where(w, people), w)
  }
  assert.throws(() => where({ field: 'by', is: Array.from({ length: limits.values + 1 }, (_, i) => `p${i}`) }, people), /lists the values/)
  // Filter offers a date, and a field with more than one value and at most
  // a handful.
  const offered = (key: string, held: string[] | undefined) => filtering(people.find((f) => f.key === key) ?? fs[2], held)
  assert.equal(offered('by', ['a', 'b']), true)
  assert.equal(offered('by', ['a']), false)
  assert.equal(offered('note', undefined), false)
  assert.equal(offered('circle', Array.from({ length: limits.values + 1 }, (_, i) => `c${i}`)), false)
  assert.equal(filtering(fs[2], undefined), true)
})

test('an address naming the retired dashboard opens in the view\'s own layout, and says nothing of it', () => {
  const asked = (search: string, look: Look = {}) => resolve(new URLSearchParams(search), [], fs, look)
  assert.equal(asked('view=dashboard').spec.layout, 'list')
  assert.equal(asked('view=dashboard', { layout: 'table' }).spec.layout, 'table')
  assert.equal(asked('view=dashboard&w=%5B%5D', { layout: 'table' }).errors.length, 0, 'widgets in the address are no longer read')
  assert.equal('widgets' in asked('view=board').spec, false)
})

test('a view saved as a dashboard opens in its collection\'s layout, its widgets dropped, and a write leaves another collection\'s as stored', () => {
  const dashboard = { id: 'c-old', name: 'Old', spec: { layout: 'dashboard', widgets: [{ kind: 'kpi', title: 'Count', measure: { op: 'count' } }] } }
  const store = { v: 1, views: { timesheets: [dashboard], invoices: [{ ...dashboard, id: 'c-feed', spec: { layout: 'feed' } }] }, pins: [] }
  const read = saved(store, (c) => (c === 'timesheets' ? 'table' : 'list'))
  const [own] = read.views.timesheets ?? []
  assert.equal(own?.spec.layout, 'table', "the timesheets' own layout")
  assert.equal('widgets' in (own?.spec ?? {}), false, 'its widgets dropped')
  assert.equal(read.views.invoices?.[0]?.spec.layout, 'list', 'a feed is still a list')
  assert.equal(saved(store).views.timesheets?.[0]?.spec.layout, 'list', 'with no layout given, a list')
  assert.deepEqual(writable(store).views.timesheets, [dashboard], 'a write of another collection or of the pins keeps it as the browser held it')
  assert.deepEqual(writable('junk').views, {})
})
