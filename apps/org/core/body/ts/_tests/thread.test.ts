// The threads' model, pure: a comment's text in parts, its mentions each
// once in the order given; a mention's label, erased once its person's name is;
// a record's comments grouped into threads; and a comment's reactions
// drawn as the six in order. Run by `cella test slice
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

test('a mention reads its person’s name, erased once it is, or the address where no one has it', () => {
  assert.equal(thread.label({ person: 'a@x', name: 'Amina' }, 'a@x'), 'Amina')
  assert.equal(thread.label({ person: 'a@x', name: 'redacted' }, 'a@x'), 'erased')
  assert.equal(thread.label(undefined, 'a@x'), 'a@x')
})

test('a record’s comments group into threads, roots oldest first, each with its replies in order, an orphan reply dropped', () => {
  const c = (id: number, parent: number | null): Comment => ({ id, author: 'a@x', name: 'A', parent, text: `#${id}`, mentions: [], posted: '2026-10-05', resolved: null, reactions: [] })
  const shown = thread.threads([c(7, 3), c(3, null), c(5, null), c(4, 3), c(9, 8)])
  assert.deepEqual(
    shown.map((t) => [t.root.id, t.replies.map((r) => r.id)]),
    [
      [3, [4, 7]],
      [5, []],
    ],
  )
})

test('a comment’s reactions draw as the six in order, each with its count and whether the reader gave it', () => {
  const drawn = thread.tally([
    { emoji: '🎉', count: 2, mine: true },
    { emoji: '👍', count: 1, mine: false },
  ])
  assert.deepEqual(drawn.map((r) => r.emoji), [...thread.reactions])
  assert.deepEqual(drawn[0], { emoji: '👍', count: 1, mine: false })
  assert.deepEqual(drawn[3], { emoji: '🎉', count: 2, mine: true })
  assert.deepEqual(drawn[1], { emoji: '❤️', count: 0, mine: false })
})
