// A comment's rich text, alone: the Markdown subset parsed into the
// nodes a comment is drawn from, a plain comment reading as it did, the
// markup a paste puts in the editor escaped, and what is typed as text
// escaped so it reads as text. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asked, html, inline, literal, parse, pasted, plain, unlisted } from '../src/models/rich.ts'

test('a box asks for a suggestion at the @ or [[ being typed, a name up to one space', () => {
  assert.deepEqual(asked('Hello @yu'), { trigger: '@', query: 'yu', length: 3 })
  assert.deepEqual(asked('@'), { trigger: '@', query: '', length: 1 })
  assert.deepEqual(asked('Hello @Yusuf D'), { trigger: '@', query: 'Yusuf D', length: 8 })
  assert.equal(asked('mail me at a@b'), null)
  assert.equal(asked('Hello @Yusuf Demir and'), null)
  assert.deepEqual(asked('see [[intern'), { trigger: '[[', query: 'intern', length: 8 })
  assert.equal(asked('see [[internal-rules]] and'), null)
})

test('a paste of one paragraph joins its line; more is blocks', () => {
  assert.equal(pasted('**a** b'), '<b>a</b> b')
  assert.equal(pasted('a\n\nb'), '<p>a</p><p>b</p>')
})

test('a plain comment is one paragraph, its lines broken where they were', () => {
  assert.deepEqual(parse('Ready?\nYes, by Friday.'), [
    { kind: 'paragraph', children: [{ kind: 'text', text: 'Ready?' }, { kind: 'break' }, { kind: 'text', text: 'Yes, by Friday.' }] },
  ])
  assert.equal(parse('one\n\ntwo').length, 2, 'a blank line starts a paragraph')
  assert.deepEqual(inline('5 * 3 * 2 and rate_card_2027'), [{ kind: 'text', text: '5 * 3 * 2 and rate_card_2027' }], 'a lone star or an underscore is text')
})

test('bold, italic, code and links, nested', () => {
  assert.deepEqual(inline('**a *b* c** `x*y*` [site](https://cella.coop)'), [
    { kind: 'bold', children: [{ kind: 'text', text: 'a ' }, { kind: 'italic', children: [{ kind: 'text', text: 'b' }] }, { kind: 'text', text: ' c' }] },
    { kind: 'text', text: ' ' },
    { kind: 'code', text: 'x*y*' },
    { kind: 'text', text: ' ' },
    { kind: 'link', href: 'https://cella.coop', children: [{ kind: 'text', text: 'site' }] },
  ])
  assert.deepEqual(inline('[x](javascript:alert(1))'), [{ kind: 'text', text: '[x](javascript:alert(1))' }], 'a link nowhere safe is text')
  assert.deepEqual(inline('\\*not\\*'), [{ kind: 'text', text: '*not*' }])
})

test("a feat's tokens stay text", () => {
  assert.deepEqual(inline('ask @[thomas@lanterne.example] about [[internal-rules]]'), [{ kind: 'text', text: 'ask @[thomas@lanterne.example] about [[internal-rules]]' }])
  assert.deepEqual(inline('**@[thomas@lanterne.example]**'), [{ kind: 'bold', children: [{ kind: 'text', text: '@[thomas@lanterne.example]' }] }])
})

test('lists and quotes group their lines', () => {
  assert.deepEqual(parse('- one\n- two\n3. three\n4. four\n> said\n> twice'), [
    { kind: 'bullet', start: 1, items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two' }]] },
    { kind: 'numbered', start: 3, items: [[{ kind: 'text', text: 'three' }], [{ kind: 'text', text: 'four' }]] },
    { kind: 'quote', children: [{ kind: 'text', text: 'said' }, { kind: 'break' }, { kind: 'text', text: 'twice' }] },
  ])
})

test('the markup a paste puts in the editor escapes every character', () => {
  assert.equal(html('**<b>** & [x](https://a.example/?q="1")'), '<p><b>&lt;b&gt;</b> &amp; <a href="https://a.example/?q=&quot;1&quot;">x</a></p>')
  assert.equal(html('- a\n\n2. b'), '<ul><li>a</li></ul><ol start="2"><li>b</li></ol>')
})

test('text typed as it is reads back as itself', () => {
  for (const typed of ['5 * 3', '`tick`', 'a\\b', '- not a list', '1. not a list', '> not a quote']) {
    const md = unlisted(literal(typed))
    assert.equal(plain(md), typed, md)
  }
  assert.equal(plain('**Ready** for *the* `assembly`?\n- yes'), 'Ready for the assembly? yes')
})
