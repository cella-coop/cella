// The drawer's properties, laid out: each in the section its kind or its
// slice names, state first; every row bare, its value's own lead or a
// glyph saying what it is, a day's lead word before it; two rows naming
// the same record one, and a phrase repeating a record's chip none. Run
// by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Component } from 'svelte'
import { leads, mark, sections, word } from '../src/models/drawer.ts'
import type { Prop } from '../src/models/view.ts'

const laid = (props: Prop[]) => sections(props).map((s) => ({ name: s.name, rows: s.rows.map((r) => r.label) }))
const icon = (name: string) => ({ name }) as unknown as Component<any>

test("a motion's states lead, its circle that also put it is one row, its dates apart", () => {
  const motion: Prop[] = [
    { label: 'Procedure', value: 'Consent' },
    { label: 'Circle', value: 'Clients', href: '/circles/clients' },
    { label: 'Put by', value: 'Clients', href: '/circles/clients' },
    { label: 'Proposed', value: '2026-10-19', kind: 'date' },
    { label: 'Deadline', value: '2026-11-02', kind: 'date' },
    { label: 'State', value: 'open', kind: 'badge' },
    { label: 'Outcome', value: 'passes', kind: 'badge' },
  ]
  assert.deepEqual(laid(motion), [
    { name: 'Properties', rows: ['State', 'Outcome', 'Circle · Put by', 'Procedure'] },
    { name: 'Dates', rows: ['Proposed', 'Deadline'] },
  ])
})

test('a state, a circle, a record and one person lead with their own mark; the rest wear a glyph', () => {
  const kind = icon('kind')
  const crowd = icon('crowd')
  const own = icon('own')
  assert.equal(leads({ label: 'State', value: 'done', kind: 'badge' }), true)
  assert.equal(leads({ label: 'Circle', value: 'brand', kind: 'circle' }), true)
  assert.equal(leads({ label: 'Client', value: 'Vélo', href: '/contacts/velo' }), true)
  assert.equal(leads({ label: 'Lead', value: null, people: ['a@x'] }), true)
  assert.equal(mark({ label: 'People', value: null, people: ['a@x', 'b@x'] }, kind, crowd), crowd)
  assert.equal(mark({ label: 'Email', value: 'a@x', glyph: own }, kind, crowd), own)
  assert.equal(mark({ label: 'Next', value: 'Launch' }, kind, crowd), kind)
  assert.equal(mark({ label: 'State', value: 'done', kind: 'badge' }, kind, crowd), undefined)
})

test('two circles that differ are two rows, never merged', () => {
  const rows = laid([
    { label: 'Circle', value: 'Clients', href: '/circles/clients' },
    { label: 'Put by', value: 'Coordination', href: '/circles/coordination' },
  ])
  assert.deepEqual(rows, [{ name: 'Properties', rows: ['Circle', 'Put by'] }])
})

test('a group its slice names is its own section, between Properties and Dates', () => {
  assert.deepEqual(
    laid([
      { label: 'Due', value: '2026-11-02', kind: 'date' },
      { label: 'Quorum', value: 'half', group: 'Meeting' },
      { label: 'Email', value: 'a@x', glyph: icon('envelope') },
    ]),
    [
      { name: 'Properties', rows: ['Email'] },
      { name: 'Meeting', rows: ['Quorum'] },
      { name: 'Dates', rows: ['Due'] },
    ],
  )
})

test('a day leads with its own word, its slice\'s or its name; a phrase only where its slice gives one', () => {
  assert.equal(word({ label: 'Deadline', value: '2026-10-31', kind: 'date', lead: 'closes' }), 'closes')
  assert.equal(word({ label: 'Issued', value: '2026-10-20', kind: 'date' }), 'issued')
  assert.equal(word({ label: 'Quorum', value: 'half the seats', lead: 'quorum' }), 'quorum')
  assert.equal(word({ label: 'Place', value: 'Studio' }), undefined)
})

test("an invoice's billed name beside its client's chip is not drawn, the chip kept", () => {
  assert.deepEqual(
    laid([
      { label: 'Bills', value: 'La Ruche', glyph: icon('receipt') },
      { label: 'Client', value: 'La Ruche', href: '/contacts/laruche' },
    ]),
    [{ name: 'Properties', rows: ['Client'] }],
  )
  assert.deepEqual(laid([{ label: 'Bills', value: 'La Ruche', glyph: icon('receipt') }]), [{ name: 'Properties', rows: ['Bills'] }])
})

test('two rows of people, null-valued and unlinked, are two rows unless their people agree', () => {
  const differ = laid([
    { label: 'Reviewers', value: null, people: ['a@x', 'b@x'] },
    { label: 'Assignees', value: null, people: ['c@x'] },
  ])
  assert.deepEqual(differ, [{ name: 'Properties', rows: ['Reviewers', 'Assignees'] }])

  const same = laid([
    { label: 'Reviewers', value: null, people: ['a@x', 'b@x'] },
    { label: 'Watchers', value: null, people: ['b@x', 'a@x'] },
  ])
  assert.deepEqual(same, [{ name: 'Properties', rows: ['Reviewers · Watchers'] }])
})

test('two rows merged keep a lead word only where both share it', () => {
  const [s] = sections([
    { label: 'Granted to', value: 'Assembly', href: '/circles/ag', lead: 'to' },
    { label: 'Issued by', value: 'Assembly', href: '/circles/ag', lead: 'issued by' },
  ])
  assert.equal(s?.rows[0]?.label, 'Granted to · Issued by')
  assert.equal(word(s!.rows[0]!.prop), undefined)
})
