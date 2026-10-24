// A view's configuration, checked against a collection's declared fields
// before the server runs it, and run over rows. Pure: no database, no
// server, though `cella test e2e` gives it both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, defaults, fields, widget, widgets } from '@cella/org-ui/models'

const fs = fields([
  { key: 'id', label: 'Invoice', kind: 'title', value: (r: any) => r.id },
  { key: 'state', label: 'Standing', kind: 'badge', value: (r: any) => r.state },
  { key: 'issued', label: 'Issued', kind: 'date', value: (r: any) => r.issued },
  { key: 'total', label: 'Total', kind: 'money', value: (r: any) => r.total },
  { key: 'owed', label: 'Owed', kind: 'money', value: (r: any) => r.owed },
])

const rows = [
  { id: 'a', state: 'unpaid', issued: '2026-08-02', total: 1000, owed: 1000 },
  { id: 'b', state: 'overdue', issued: '2026-10-01', total: 500, owed: 300 },
  { id: 'c', state: 'paid', issued: '2026-10-20', total: 200, owed: 0 },
]

test('the fields are typed from the columns', () => {
  assert.deepEqual(
    fs.map((f) => [f.key, f.type]),
    [['id', 'text'], ['state', 'enum'], ['issued', 'date'], ['total', 'money'], ['owed', 'money']],
  )
})

test('a widget over declared fields passes, as the plain object it was', () => {
  const owed = { kind: 'kpi', title: 'Owed', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['unpaid', 'overdue'] }] }
  assert.deepEqual(widget(owed, fs), owed)
  const chart = { kind: 'chart', title: 'By month', measure: { op: 'count' }, by: 'issued', where: [{ field: 'issued', within: 'year' }] }
  assert.deepEqual(widget(chart, fs), chart)
})

test('a widget naming anything undeclared, or asking what a field cannot give, is refused', () => {
  const refused: [unknown, RegExp][] = [
    [{ kind: 'kpi', title: 'x', measure: { op: 'sum', field: 'owed; DROP TABLE invoice.invoice' } }, /names no field/],
    [{ kind: 'kpi', title: 'x', measure: { op: 'sum', field: 'state' } }, /not a number/],
    [{ kind: 'kpi', title: 'x', measure: { op: 'median', field: 'owed' } }, /op is one of/],
    [{ kind: 'kpi', title: '', measure: { op: 'count' } }, /title/],
    [{ kind: 'pie', title: 'x', measure: { op: 'count' } }, /kpi or a chart/],
    [{ kind: 'chart', title: 'x', measure: { op: 'count' }, by: 'total' }, /groups by an enumeration or a date/],
    [{ kind: 'kpi', title: 'x', measure: { op: 'count' }, where: [{ field: 'total', is: ['1'] }] }, /on an enumeration or a date/],
    [{ kind: 'kpi', title: 'x', measure: { op: 'count' }, where: [{ field: 'state', is: [] }] }, /lists the values/],
    [{ kind: 'kpi', title: 'x', measure: { op: 'count' }, where: [{ field: 'issued', within: 'decade' }] }, /month or year/],
    ['DROP', /an object/],
  ]
  for (const [x, message] of refused) {
    assert.throws(() => widget(x, fs), message, JSON.stringify(x))
  }
})

test('a dashboard keeps its sound widgets and says what it dropped', () => {
  const ok = { kind: 'kpi', title: 'Count', measure: { op: 'count' } }
  const { widgets: kept, errors } = widgets([ok, { kind: 'kpi', title: 'x', measure: { op: 'sum', field: 'nope' } }], fs)
  assert.deepEqual(kept, [ok])
  assert.equal(errors.length, 1)
  assert.deepEqual(widgets('not a list', fs).widgets, [])
  assert.equal(widgets(Array.from({ length: 20 }, () => ok), fs).widgets.length, 12)
})

test('the defaults are sound widgets over the fields', () => {
  const ds = defaults(fs)
  assert.deepEqual(widgets(ds, fs).errors, [])
  assert.deepEqual(
    ds.map((w) => w.title),
    ['Count', 'Total', 'By standing', 'Total by month, issued'],
  )
})

test('widgets run over the rows: figures, bars by value, a line through every month', () => {
  const [owed, overdue, months, standing] = aggregate(
    [
      { kind: 'kpi', title: 'Owed', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['unpaid', 'overdue'] }] },
      { kind: 'kpi', title: 'This month', measure: { op: 'count' }, where: [{ field: 'issued', within: 'month' }] },
      { kind: 'chart', title: 'By month', measure: { op: 'sum', field: 'total' }, by: 'issued' },
      { kind: 'chart', title: 'By standing', measure: { op: 'count' }, by: 'state' },
    ],
    rows,
    fs,
    '2026-10-24',
  )
  assert.deepEqual(owed, { kind: 'kpi', title: 'Owed', format: 'money', value: 1300 })
  assert.deepEqual(overdue, { kind: 'kpi', title: 'This month', format: 'number', value: 2 })
  assert.deepEqual(months, {
    kind: 'chart',
    title: 'By month',
    format: 'money',
    line: true,
    points: [
      { label: '2026-08', value: 1000 },
      { label: '2026-09', value: 0 },
      { label: '2026-10', value: 700 },
    ],
  })
  assert.equal(standing.kind === 'chart' && standing.line, false)
})
