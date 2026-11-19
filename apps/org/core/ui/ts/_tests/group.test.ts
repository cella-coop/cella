// A group's header, alone: the ink it wears, only a closed set's (a
// state's whose tone has no colour of its own, seeded by its value),
// never an open set's (a record's, a circle's, a person's), a month's or
// no value's; and the primary button's ink, landed in `styles/base.css`,
// still the specimen's lead. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { closed, type Column } from '../src/models/view.ts'
import { fields, groupable, groupTint, laned } from '../src/models/query.ts'
import { HUES, inkOf, nth, ROLES } from '../src/models/ink.ts'

const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')

const project: Column = { key: 'project', label: 'Project', kind: 'badge', record: 'projects', value: () => undefined }
const status: Column = { key: 'status', label: 'Status', kind: 'badge', tone: () => 'accent', value: () => undefined }
const month: Column = { key: 'due', label: 'Due', kind: 'date', value: () => undefined }
const person: Column = { key: 'member', label: 'Member', kind: 'person', value: () => undefined }
const circle: Column = { key: 'circle', label: 'Circle', kind: 'circle', record: 'circles', value: () => undefined }

test('a state whose tone has no colour of its own wears an ink seeded by its value', () => {
  assert.equal(groupTint(status, 'open', false, 'accent'), inkOf('open'))
  assert.equal(groupTint(status, 'draft', false), inkOf('draft'))
  assert.ok(closed(status.kind, status.record) && closed('priority') && closed('boolean'), 'a state, a priority and a boolean are closed sets')
})

test('a state with a tone of its own keeps it, and takes no ink', () => {
  assert.equal(groupTint(status, 'paid', false, 'positive'), null)
})

test('an open set takes no ink: a record, even drawn as a badge, a circle and a person', () => {
  assert.equal(groupTint(project, 'Alpha', false), null, 'a project')
  assert.equal(groupTint(circle, 'web', false), null, 'a circle')
  assert.equal(groupTint(person, 'camille@lanterne.example', false), null, 'a person')
  assert.ok(!closed(project.kind, project.record) && !closed('circle') && !closed('person') && !closed('text'), 'each an open set')
})

test('a month and no value take no ink either', () => {
  assert.equal(groupTint(status, '2026-11', true), null, 'a month')
  assert.equal(groupTint(status, '', false), null, 'no value')
})

test('the primary button already wears the specimen\'s lead ink', () => {
  const lead = nth(0)
  assert.match(base, new RegExp(`--primary-fill: oklch\\(${ROLES.fill.light} ${ROLES.fill.c} ${HUES[lead]}\\);`), 'the fill is the lead ink, fixed in both themes')
})

test('a view groups by a record link, a boolean and a text field of few values, never free text, money or numbers', () => {
  const [client, done, kind, title, budget, count, date] = fields([
    { key: 'client', label: 'Client', kind: 'mono', record: 'contacts', value: () => undefined },
    { key: 'done', label: 'Done', kind: 'boolean', value: () => undefined },
    { key: 'kind', label: 'Kind', value: () => undefined },
    { key: 'title', label: 'Title', kind: 'title', value: () => undefined },
    { key: 'budget', label: 'Budget', kind: 'money', value: () => undefined },
    { key: 'count', label: 'Count', kind: 'number', value: () => undefined },
    { key: 'due', label: 'Due', kind: 'date', value: () => undefined },
  ])
  assert.ok(groupable(client) && groupable(done), 'a record link and a boolean')
  assert.ok(groupable(kind), 'text, while the values are not yet known')
  assert.ok(groupable(kind, ['a', 'b']), 'text with a few values')
  assert.ok(!groupable(kind, []) && !groupable(kind, Array.from({ length: 21 }, (_, i) => String(i))), 'no values, or more than twenty')
  assert.ok(!groupable(title, ['a']) && !groupable(budget) && !groupable(count), 'a title, money and numbers stay out')
  assert.ok(groupable(date) && !laned(date), 'a date groups but never makes a board\'s column')
  assert.ok(laned(done) && laned(client), 'a boolean and a record link lane a board')
})
