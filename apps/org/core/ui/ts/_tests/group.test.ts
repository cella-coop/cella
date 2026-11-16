// A group's header, alone: the ink it wears, a record's own, seeded by
// its name, none for an enumeration keeping its tone, a month or no
// value; and the primary button's ink, landed in `styles/base.css`,
// still the specimen's lead. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Column } from '../src/models/view.ts'
import { groupTint } from '../src/models/query.ts'
import { HUES, inkOf, nth, ROLES } from '../src/models/ink.ts'

const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')

const project: Column = { key: 'project', label: 'Project', kind: 'badge', record: 'projects', value: () => undefined }
const status: Column = { key: 'status', label: 'Status', kind: 'badge', tone: () => 'accent', value: () => undefined }
const month: Column = { key: 'due', label: 'Due', kind: 'date', value: () => undefined }
const person: Column = { key: 'member', label: 'Member', kind: 'person', value: () => undefined }

test('a record names its own ink, even drawn as a badge, as a project does', () => {
  assert.equal(groupTint(project, 'Alpha', false), inkOf('Alpha'))
  assert.equal(groupTint(project, 'Beta', false), inkOf('Beta'))
  assert.notEqual(inkOf('Alpha'), undefined)
})

test('an enumeration with a tone of its own keeps it, and takes no ink', () => {
  assert.equal(groupTint(status, 'open', false), null)
})

test('a month, no value, and no record take no ink either', () => {
  assert.equal(groupTint(project, '2026-11', true), null, 'a month')
  assert.equal(groupTint(project, '', false), null, 'no value')
  assert.equal(groupTint(person, 'camille@lanterne.example', false), null, 'a person names no record')
})

test('the primary button already wears the specimen\'s lead ink', () => {
  const lead = nth(0)
  assert.match(base, new RegExp(`--primary-fill: oklch\\(${ROLES.fill.light} ${ROLES.fill.c} ${HUES[lead]}\\);`), 'the fill is the lead ink, fixed in both themes')
})
