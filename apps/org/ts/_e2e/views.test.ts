// A view's configuration, checked against a collection's declared fields
// before the server runs it, and what the server measured shaped for the
// dashboard. Pure: no database, no server, though `cella test e2e` gives
// it both; `reads` runs the widgets in SQL.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaults, fields, result, widget, widgets, type Widget } from '@cella/org-ui/models'

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

test('what the server measured is shaped into figures, bars by value and a line through every month', () => {
  const ws = [
    { kind: 'kpi', title: 'Owed', measure: { op: 'sum', field: 'owed' }, where: [{ field: 'state', is: ['unpaid', 'overdue'] }] },
    { kind: 'kpi', title: 'Average', measure: { op: 'avg', field: 'total' }, where: [{ field: 'state', is: ['voided'] }] },
    { kind: 'chart', title: 'By month', measure: { op: 'sum', field: 'total' }, by: 'issued' },
    { kind: 'chart', title: 'By standing', measure: { op: 'count' }, by: 'state' },
  ] satisfies Widget[]
  const measured = [
    1300,
    null,
    [
      { label: '2026-08', value: 1000 },
      { label: '2026-10', value: 700 },
    ],
    [
      { label: 'overdue', value: 1 },
      { label: 'paid', value: 1 },
      { label: 'unpaid', value: 2 },
    ],
  ]
  const [owed, average, months, standing] = ws.map((w, i) => result(w, measured[i], fs))
  assert.deepEqual(owed, { kind: 'kpi', title: 'Owed', format: 'money', value: 1300 })
  assert.deepEqual(average, { kind: 'kpi', title: 'Average', format: 'money', value: null }, 'nothing to average over is no figure')
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
  assert.deepEqual(standing.kind === 'chart' && standing.points.map((p) => p.label), ['unpaid', 'overdue', 'paid'], 'bars by value, the largest first')
})
