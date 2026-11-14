// The calendar layout: a month as whole weeks from Monday, a week, the
// rows on their days in the order of their time, and the view's date and
// span carried in the address and checked against the fields, and the
// inks a calendar grouped by a field hands its values. Pure: no
// database, no server, though `cella test e2e` gives it both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { address, anchor, fields, legend, period, placed, resolve, spec, time } from '@cella/org-ui/models'

const fs = fields([
  { key: 'title', label: 'Meeting', kind: 'title', value: (r: any) => r.title },
  { key: 'status', label: 'Status', kind: 'badge', value: (r: any) => r.status },
  { key: 'at', label: 'When', kind: 'date', value: (r: any) => r.at },
  { key: 'scheduled', label: 'Scheduled', kind: 'date', value: (r: any) => r.scheduled },
])

test('a month runs in whole weeks from the Monday on or before its first day', () => {
  const october = period('2026-10-24', 'month', '2026-10-24')
  assert.equal(october.label, 'October 2026')
  assert.equal(october.days.length, 35)
  assert.equal(october.days[0].day, '2026-09-28')
  assert.equal(october.days.at(-1)?.day, '2026-11-01')
  assert.deepEqual(october.days.filter((d) => d.inside).length, 31)
  assert.deepEqual(october.days.filter((d) => d.today).map((d) => d.day), ['2026-10-24'])
  assert.deepEqual([october.prev, october.next], ['2026-09-01', '2026-11-01'])
  const february = period('2027-02-10', 'month', '2026-10-24')
  assert.equal(february.days.length, 28, 'February 2027 starts on a Monday and fills four weeks')
})

test('a week runs Monday to Sunday', () => {
  const week = period('2026-10-28', 'week', '2026-10-24')
  assert.deepEqual(week.days.map((d) => d.day), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  assert.equal(week.label, '26 Oct – 1 Nov 2026')
  assert.deepEqual([week.prev, week.next], ['2026-10-19', '2026-11-02'])
})

test('rows sit on their day in the order of their time; a row with no date sits nowhere', () => {
  const rows = [
    { id: 'a', title: 'Assembly', at: '2026-10-31T10:00' },
    { id: 'b', title: 'Coordination', at: '2026-10-26T10:00' },
    { id: 'c', title: 'Web', at: '2026-10-26T09:00' },
    { id: 'd', title: 'Someday', at: null },
    { id: 'e', title: 'Last year', at: '2025-10-26T09:00' },
  ]
  const on = fs.find((f) => f.key === 'at')!
  const days = placed(rows, on, period('2026-10-26', 'week', '2026-10-24'))
  assert.deepEqual(days.get('2026-10-26')?.map((r) => r.id), ['c', 'b'])
  assert.deepEqual(days.get('2026-10-31')?.map((r) => r.id), ['a'])
  assert.equal([...days.values()].flat().length, 3)
  assert.deepEqual([time('2026-10-26T09:00'), time('2026-10-26'), time(null)], ['09:00', '', ''])
})

test('the address carries the calendar\'s date and span, each checked against the fields', () => {
  const look = { layout: 'calendar' as const, on: 'at', span: 'month' as const }
  const plain = resolve(new URLSearchParams(''), [{ id: 'all', name: 'All' }], fs, look)
  assert.deepEqual([plain.spec.layout, plain.spec.on, plain.spec.span], ['calendar', 'at', 'month'])
  const asked = resolve(new URLSearchParams('on=scheduled&span=week'), [{ id: 'all', name: 'All' }], fs, look)
  assert.deepEqual([asked.spec.on, asked.spec.span], ['scheduled', 'week'])
  const wrong = resolve(new URLSearchParams('on=status&span=decade'), [{ id: 'all', name: 'All' }], fs, look)
  assert.deepEqual([wrong.spec.on, wrong.spec.span], ['at', 'month'], 'an enumeration places nothing, and a decade is no span')
  assert.equal(address('all', { ...spec(undefined, look), span: 'week' }, spec(undefined, look)), '?span=week')
  assert.equal(address('all', spec(undefined, look), spec(undefined, look)), '?')
})

test('the day a calendar is at is an ISO day from the address, else today', () => {
  assert.equal(anchor('2026-06-20', '2026-10-24'), '2026-06-20')
  assert.equal(anchor('June', '2026-10-24'), '2026-10-24')
  assert.equal(anchor('2026-13-45', '2026-10-24'), '2026-10-24')
  assert.equal(anchor(null, '2026-10-24'), '2026-10-24')
})

test('a calendar grouped by a field hands its values the inks in turn, by their place in the board\'s order, None last and of none', () => {
  const rows = [
    { id: 'a', status: 'held' },
    { id: 'b', status: 'scheduled' },
    { id: 'c', status: null },
    { id: 'd', status: 'held' },
    { id: 'e', status: 'postponed' },
  ]
  const keys = legend(rows, 'status', ['scheduled', 'held', 'cancelled'])
  assert.deepEqual(
    keys.map((k) => [k.value, k.count, k.ink]),
    [['scheduled', 1, 3], ['held', 2, 1], ['postponed', 1, 4], ['', 1, null]],
    'cancelled holds no row and is not named, yet keeps its place, so held keeps its ink in a month without one',
  )
  assert.deepEqual(keys.map((k) => k.row.id), ['b', 'a', 'e', 'c'])
  const many = Array.from({ length: 7 }, (_, i) => ({ id: String(i), circle: `c${i}` }))
  assert.deepEqual(legend(many, 'circle', []).map((k) => k.ink), [3, 1, 2, 4, 0, 3, 1], 'the site\'s turn from the blue, and past five round again')
})
