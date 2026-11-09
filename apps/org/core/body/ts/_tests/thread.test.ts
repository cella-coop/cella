// The threads' model, pure: a comment's text in parts, its mentions each
// once in the order given; a box's typed `@name` posted as `@[address]`
// for the people the picker picked alone; the `@` being typed, which the
// picker answers; a mention's label, erased once its person's name is;
// and a record's comments grouped into threads. Run by `cella test slice
// body`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { thread, type Comment } from '../src/models/index.ts'

test('a text reads in parts, each mention once in the order given', () => {
  const text = 'Ask @[yusuf@lanterne.example] and @[Amina@lanterne.example], then @[yusuf@lanterne.example] again'
  assert.deepEqual(thread.parts(text), [
    { text: 'Ask ' },
    { mention: 'yusuf@lanterne.example' },
    { text: ' and ' },
    { mention: 'amina@lanterne.example' },
    { text: ', then ' },
    { mention: 'yusuf@lanterne.example' },
    { text: ' again' },
  ])
  assert.deepEqual(thread.mentioned(text), ['yusuf@lanterne.example', 'amina@lanterne.example'])
  assert.deepEqual(thread.mentioned('an address, yusuf@lanterne.example, is no mention'), [])
})

test('a box posts each picked person’s @name as their @[address], the longest name first, and leaves a name no one picked', () => {
  const picked = [
    { person: 'ana@x.example', name: 'Ana' },
    { person: 'ana.b@x.example', name: 'Ana Bell' },
  ]
  assert.deepEqual(thread.composed('@Ana Bell and @Ana, not @Hugo', picked), {
    text: '@[ana.b@x.example] and @[ana@x.example], not @Hugo',
    mentions: ['ana.b@x.example', 'ana@x.example'],
  })
})

test('the picker answers the @ being typed at the end, up to one space', () => {
  assert.equal(thread.asking('Hello @yu'), 'yu')
  assert.equal(thread.asking('@'), '')
  assert.equal(thread.asking('Hello @Yusuf D'), 'Yusuf D')
  assert.equal(thread.asking('mail me at a@b'), null)
  assert.equal(thread.asking('Hello @Yusuf Demir and'), null)
})

test('a mention reads its person’s name, erased once it is, or the address where no one has it', () => {
  assert.equal(thread.label({ person: 'a@x', name: 'Amina' }, 'a@x'), 'Amina')
  assert.equal(thread.label({ person: 'a@x', name: 'redacted' }, 'a@x'), 'erased')
  assert.equal(thread.label(undefined, 'a@x'), 'a@x')
})

test('a record’s comments group into threads, roots oldest first, each with its replies in order, an orphan reply dropped', () => {
  const c = (id: number, parent: number | null): Comment => ({ id, author: 'a@x', name: 'A', parent, text: `#${id}`, mentions: [], posted: '2026-10-05', resolved: null })
  const shown = thread.threads([c(7, 3), c(3, null), c(5, null), c(4, 3), c(9, 8)])
  assert.deepEqual(
    shown.map((t) => [t.root.id, t.replies.map((r) => r.id)]),
    [
      [3, [4, 7]],
      [5, []],
    ],
  )
})
