// A settings field left, alone: whether its reader's own write saves it,
// and the motion offered instead where it does not, prefilled with the
// circle that decides it, a title saying the change, the action and its
// arguments and the deadline asked for, its reason the guard's own words,
// joined by every other change of its kind still not saved. Run by
// `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changer, direct, offer, type Decider, type Setting } from '../src/models/settings.ts'

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

const named = (name: string) => settings.find((s) => s.name === name)!

test('a field refused its reader, left, offers the motion that changes it, its reason the guard\'s words', () => {
  assert.deepEqual(offer(settings, { name: 'Camille Martin-Roy', circle: 'Operations' }, assembly, named('circle')), {
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
})

test('a field its reader writes, or one left unchanged, offers nothing', () => {
  assert.equal(offer(settings, { name: 'Camille Martin-Roy' }, assembly, named('name')), null)
  assert.equal(offer(settings, { circle: 'Coordination' }, assembly, named('circle')), null)
  assert.equal(offer(settings, {}, assembly, named('circle')), null)
})

test('the changes of its kind join the motion, its reason said once; another kind is left out', () => {
  const p = offer(settings, { circle: 'Operations', purpose: 'Runs the co-op day to day', procedure: 'majority' }, assembly, named('purpose'))
  assert.equal(p?.kind, 'amend-circle')
  assert.equal(p?.title, 'Rename Coordination to Operations; Change purpose from “Runs the co-op between assemblies” to “Runs the co-op day to day”')
  assert.deepEqual(p?.args.map((a) => [a.name, a.value]), [['circle', 'coordination'], ['name', 'Operations'], ['purpose', 'Runs the co-op day to day']])
  assert.deepEqual(p?.reasons, [refusal])
  assert.deepEqual(p?.fields, ['circle', 'purpose'])
  assert.equal(offer(settings, { circle: 'Operations', procedure: 'majority' }, assembly, named('procedure'))?.fields.join(), 'procedure')
})

test('with no motion declared, or no circle to decide it, nothing is offered', () => {
  assert.equal(offer(settings, { timezone: 'Europe/Brussels' }, assembly, named('timezone')), null)
  assert.equal(offer(settings, { circle: 'Operations' }, null, named('circle')), null)
})

test('each setting says what changes it: the reader\'s write, a motion of the deciding circle, or nothing they may write', () => {
  assert.deepEqual(settings.map(direct), [true, true, true, false, false, false, false])
  assert.equal(changer(settings[0], assembly), 'You change it here')
  assert.equal(changer(settings[3], assembly), 'A motion of General assembly changes it')
  assert.equal(changer(settings[6], assembly), 'Nothing you may write changes it')
})
