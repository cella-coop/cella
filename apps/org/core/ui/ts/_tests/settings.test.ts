// A settings form's Save, alone: which fields changed its reader's own
// writes save, each write once with its fields, and which the motion it
// offers instead proposes, prefilled with the circle that decides it, a
// title saying the change, the action and its arguments and the deadline
// asked for, its reason the guard's own words. Run by `cella test slice
// ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changer, direct, plan, type Decider, type Setting } from '../src/models/settings.ts'

const refusal = 'camille@lanterne.example holds no amend-circle in coordination: only a motion of General assembly renames it'
const assembly: Decider = { circle: 'ag', name: 'General assembly', deadline: '2026-11-23' }
const amend = (field: string) => ({
  kind: 'amend-circle',
  args: (value: string) => ({ circle: 'coordination', [field]: value }),
  labels: { [field]: field === 'name' ? 'New name' : 'Purpose' },
})
const settings: Setting[] = [
  { name: 'name', label: 'Your name', value: 'Camille Martin', write: 'profile' },
  { name: 'email', label: 'Email', value: 'camille@lanterne.example', write: 'profile' },
  { name: 'theme', label: 'Theme', value: 'system', write: 'theme' },
  { name: 'circle', label: 'Name', value: 'Coordination', write: 'rename', refused: refusal, motion: { ...amend('name'), says: (v, was) => `Rename ${was} to ${v}` } },
  { name: 'purpose', label: 'Purpose', value: 'Runs the co-op between assemblies', refused: refusal, motion: amend('purpose') },
  { name: 'procedure', label: 'Procedure', value: 'consent', refused: refusal, motion: { kind: 'amend-procedure', args: (v) => ({ procedure: v }) } },
  { name: 'timezone', label: 'Timezone', value: 'Europe/Paris' },
]

test('a field the reader writes saves, and one refused them is offered as a motion, in one Save', () => {
  const p = plan(settings, { name: 'Camille Martin-Roy', circle: 'Operations' }, assembly)
  assert.deepEqual(p.saves, [{ write: 'profile', fields: { name: 'Camille Martin-Roy' } }])
  assert.deepEqual(p.proposal, {
    circle: 'ag',
    name: 'General assembly',
    title: 'Rename Coordination to Operations',
    deadline: '2026-11-23',
    kind: 'amend-circle',
    args: [
      { name: 'circle', label: null, value: 'coordination' },
      { name: 'name', label: 'New name', value: 'Operations' },
    ],
    reasons: [refusal],
    fields: ['circle'],
  })
  assert.deepEqual(p.left, [])
})

test('only the fields changed post, each write once with all its fields', () => {
  const p = plan(settings, { name: 'Camille Martin', email: 'c@lanterne.example', theme: 'dark' }, assembly)
  assert.deepEqual(p.saves, [
    { write: 'profile', fields: { email: 'c@lanterne.example' } },
    { write: 'theme', fields: { theme: 'dark' } },
  ])
  assert.equal(p.proposal, null)
  assert.deepEqual(plan(settings, {}, assembly), { saves: [], proposal: null, left: [] })
})

test('the fields of one kind join one motion, its reason said once; another kind waits for the next Save', () => {
  const p = plan(settings, { circle: 'Operations', purpose: 'Runs the co-op day to day', procedure: 'majority' }, assembly)
  assert.equal(p.proposal?.kind, 'amend-circle')
  assert.equal(p.proposal?.title, 'Rename Coordination to Operations; Change purpose from “Runs the co-op between assemblies” to “Runs the co-op day to day”')
  assert.deepEqual(p.proposal?.args.map((a) => [a.name, a.value]), [['circle', 'coordination'], ['name', 'Operations'], ['purpose', 'Runs the co-op day to day']])
  assert.deepEqual(p.proposal?.reasons, [refusal])
  assert.deepEqual(p.proposal?.fields, ['circle', 'purpose'])
  assert.deepEqual(p.left, ['procedure'])
})

test('with no motion declared, or no circle to decide it, a change is left not saved and nothing is offered', () => {
  assert.deepEqual(plan(settings, { timezone: 'Europe/Brussels' }, assembly), { saves: [], proposal: null, left: ['timezone'] })
  assert.deepEqual(plan(settings, { circle: 'Operations' }, null), { saves: [], proposal: null, left: ['circle'] })
})

test('each setting says what changes it: the reader\'s write, a motion of the deciding circle, or nothing they may write', () => {
  assert.deepEqual(settings.map(direct), [true, true, true, false, false, false, false])
  assert.equal(changer(settings[0], assembly), 'You change it here')
  assert.equal(changer(settings[3], assembly), 'A motion of General assembly changes it')
  assert.equal(changer(settings[6], assembly), 'Nothing you may write changes it')
})
