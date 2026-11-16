// A settings form's model, alone: the fields a setting's write posts as
// it saves, those that write saves that changed, as typed;
// and the motion offered for a change no write of the reader's makes,
// prefilled with the circle that decides it, a title saying the change,
// the action and its arguments and the deadline asked for, its reason
// the guard's own words and the change it proposes. Run by `cella test
// slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { direct, who, posted, proposal, type Decider, type Setting } from '../src/models/settings.ts'

const refusal = 'camille@lanterne.example holds no amend-circle in coordination: only a motion of Assembly renames it'
const assembly: Decider = { circle: 'ag', name: 'Assembly', deadline: '2026-11-23' }
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
  { name: 'purpose', label: 'Purpose', value: 'Runs the co-op between assemblies', motion: amend('purpose') },
  { name: 'timezone', label: 'Timezone', value: 'Europe/Paris' },
]
const typed: Record<string, string> = { name: 'Camille Martin-Roy' }
const value = (s: Setting) => typed[s.name] ?? s.value

test('a setting\'s write posts the fields it saves that changed, as typed, and no other', () => {
  assert.deepEqual(posted(settings, settings[0], value), { name: 'Camille Martin-Roy' })
  assert.deepEqual(posted(settings, settings[1], (s) => ({ ...typed, email: 'c@lanterne.example' })[s.name] ?? s.value), { name: 'Camille Martin-Roy', email: 'c@lanterne.example' })
  assert.deepEqual(posted(settings, settings[2], value), {})
})

test('a change refused the reader is offered as the deciding circle\'s motion, its reason the guard\'s words', () => {
  assert.deepEqual(proposal(settings[3], 'Operations', assembly), {
    circle: 'ag',
    name: 'Assembly',
    title: 'Rename Coordination to Operations',
    deadline: '2026-11-23',
    kind: 'amend-circle',
    args: [
      { name: 'circle', label: null, value: 'coordination' },
      { name: 'name', label: 'New name', value: 'Operations' },
    ],
    reason: refusal,
    field: 'circle',
    change: { label: 'Name', was: 'Coordination', value: 'Operations' },
  })
})

test('a setting with no write of its own says so, and its title the change where the motion words none', () => {
  const p = proposal(settings[4], 'Runs the co-op day to day', assembly)
  assert.equal(p?.title, 'Change purpose from “Runs the co-op between assemblies” to “Runs the co-op day to day”')
  assert.equal(p?.reason, 'Purpose has no write of its own: Assembly changes it by motion')
})

test('with no motion declared, or no circle to decide it, nothing is offered', () => {
  assert.equal(proposal(settings[5], 'Europe/Brussels', assembly), null)
  assert.equal(proposal(settings[3], 'Operations', null), null)
})

test('each setting says who changes it beside its label: no one but the reader, a motion of the deciding circle, a change waiting to be proposed, or nothing they may write', () => {
  assert.deepEqual(settings.map(direct), [true, true, true, false, false, false])
  assert.equal(who(settings[0], assembly), null, 'a field the reader saves wears no icon')
  assert.deepEqual([who(settings[3], assembly)?.kind, who(settings[3], assembly)?.label], ['motion', 'Assembly changes this by motion'])
  assert.equal(who(settings[3], assembly, true)?.label, 'Proposed to Assembly')
  assert.equal(who(settings[5], assembly)?.kind, 'locked')
})
