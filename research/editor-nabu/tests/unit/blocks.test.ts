import { describe, expect, it } from 'vitest'
import { all, byText, ev, make, sel, settle, shape, t } from './helpers.ts'

// nabu's own operations, driven without a DOM: each takes the selection
// it would read from the page as an argument.

describe('split', () => {
  it('Enter in a paragraph splits it, keeping marks on both sides', async () => {
    const nabu = make([{ type: 'paragraph', delta: [t('Day '), t('rate', { bold: true }), t(' card')] }])
    const p = nabu.children[0] as any
    p.behavior.handleInsertParagraph(ev('insertParagraph'), sel(6))
    await settle()
    expect(shape(nabu)).toEqual([
      { type: 'paragraph', text: [{ text: 'Day ' }, { text: 'ra', marks: { bold: true } }] },
      { type: 'paragraph', text: [{ text: 'te', marks: { bold: true } }, { text: ' card' }] },
    ])
  })

  it('Enter in a heading puts a paragraph after it', async () => {
    const nabu = make([{ type: 'heading', level: 2, delta: [t('Services')] }])
    ;(nabu.children[0] as any).behavior.handleInsertParagraph(ev('insertParagraph'), sel(8))
    await settle()
    expect(shape(nabu).map((b) => b.type)).toEqual(['heading', 'paragraph'])
  })

  it('Enter in a list item makes a sibling item', async () => {
    const nabu = make([{ type: 'list', listType: 'bullet', items: [{ delta: [t('onetwo')] }] }])
    byText(nabu, 'onetwo').behavior.handleInsertParagraph(ev('insertParagraph'), sel(3))
    await settle()
    expect(shape(nabu)).toEqual([
      { type: 'bullet', text: [{ text: 'one' }] },
      { type: 'bullet', text: [{ text: 'two' }] },
    ])
  })
})

describe('merge', () => {
  it('Backspace at the start of a paragraph joins it to the one before', async () => {
    const nabu = make([
      { type: 'paragraph', delta: [t('one')] },
      { type: 'paragraph', delta: [t('two', { italic: true })] },
    ])
    byText(nabu, 'two').behavior.handleDeleteContentBackward(ev('deleteContentBackward'), sel(0))
    await settle()
    expect(shape(nabu)).toEqual([{ type: 'paragraph', text: [{ text: 'one' }, { text: 'two', marks: { italic: true } }] }])
  })

  it('Delete at the end of a paragraph pulls the next one in, across block types', async () => {
    const nabu = make([
      { type: 'heading', level: 1, delta: [t('Rate')] },
      { type: 'paragraph', delta: [t(' card')] },
    ])
    byText(nabu, 'Rate').behavior.handleDeleteContentForward(ev('deleteContentForward'), sel(4))
    await settle()
    expect(shape(nabu)).toEqual([{ type: 'heading', props: { level: 1 }, text: [{ text: 'Rate card' }] }])
  })

  it('Backspace at the start of the first list item lands in the paragraph above', async () => {
    const nabu = make([
      { type: 'paragraph', delta: [t('above')] },
      { type: 'list', listType: 'bullet', items: [{ delta: [t('item')] }, { delta: [t('next')] }] },
    ])
    byText(nabu, 'item').behavior.handleDeleteContentBackward(ev('deleteContentBackward'), sel(0))
    await settle()
    expect(shape(nabu)).toEqual([
      { type: 'paragraph', text: [{ text: 'aboveitem' }] },
      { type: 'bullet', text: [{ text: 'next' }] },
    ])
  })
})

describe('indent', () => {
  const list = () =>
    make([{ type: 'list', listType: 'bullet', items: [{ delta: [t('a')] }, { delta: [t('b')] }, { delta: [t('c')] }] }])
  const tab = (shiftKey = false) => ({ key: 'Tab', shiftKey, preventDefault() {} }) as any

  it('Tab nests an item under the one before', async () => {
    const nabu = list()
    byText(nabu, 'b').keydown(tab())
    await settle()
    expect(shape(nabu)).toEqual([
      { type: 'bullet', text: [{ text: 'a' }], children: [{ type: 'bullet', text: [{ text: 'b' }] }] },
      { type: 'bullet', text: [{ text: 'c' }] },
    ])
  })

  it('Shift-Tab lifts it back and carries its followers', async () => {
    const nabu = list()
    byText(nabu, 'b').keydown(tab())
    await settle()
    byText(nabu, 'c').keydown(tab())
    await settle()
    byText(nabu, 'b').keydown(tab(true))
    await settle()
    expect(shape(nabu)).toEqual([
      { type: 'bullet', text: [{ text: 'a' }] },
      { type: 'bullet', text: [{ text: 'b' }], children: [{ type: 'bullet', text: [{ text: 'c' }] }] },
    ])
  })

  it('Tab on the first item does nothing', async () => {
    const nabu = list()
    const before = shape(nabu)
    byText(nabu, 'a').keydown(tab())
    await settle()
    expect(shape(nabu)).toEqual(before)
  })
})

describe('move', () => {
  it('moves a block, the decision embed included, among its siblings', async () => {
    const nabu = make([
      { type: 'paragraph', delta: [t('one')] },
      { type: 'decision', ref: 'd-2026-011' },
      { type: 'paragraph', delta: [t('two')] },
    ])
    const [one, decision] = nabu.children as any[]
    one.node.moveAfter(decision.node)
    await nabu.commit()
    expect(shape(nabu).map((b) => b.type)).toEqual(['decision', 'paragraph', 'paragraph'])
    decision.node.moveAfter((nabu.children[2] as any).node)
    await nabu.commit()
    expect(nabu.children.map((b: any) => b.type)).toEqual(['paragraph', 'paragraph', 'decision'])
  })
})

describe('marks', () => {
  it('marks, toggles and links ranges of one block', async () => {
    const nabu = make([{ type: 'paragraph', delta: [t('560 € a day')] }])
    const b = (nabu.children[0] as any).behavior
    b.toggleMark('bold', true, sel(0, 5))
    b.applyMark('italic', true, sel(4, 11))
    b.applyMark('link', 'https://lanterne.example', sel(6, 11))
    await nabu.commit()
    expect(shape(nabu)[0].text).toEqual([
      { text: '560 ', marks: { bold: true } },
      { text: '€', marks: { bold: true, italic: true } },
      { text: ' ', marks: { italic: true } },
      { text: 'a day', marks: { italic: true, link: 'https://lanterne.example' } },
    ])
    b.toggleMark('bold', true, sel(0, 5))
    await nabu.commit()
    expect(shape(nabu)[0].text?.[0]).toEqual({ text: '560 ' })
  })

  it('marks do not grow when typing at their edge', async () => {
    const nabu = make([{ type: 'paragraph', delta: [t('bold', { bold: true })] }])
    const b = (nabu.children[0] as any).behavior
    b.insert(4, '!')
    await nabu.commit()
    expect(shape(nabu)[0].text).toEqual([{ text: 'bold', marks: { bold: true } }, { text: '!' }])
  })
})

describe('upstream behaviour worth knowing', () => {
  it('a block created at index 0 is appended instead (`index || undefined`)', async () => {
    const nabu = make([{ type: 'paragraph', delta: [t('first')] }])
    nabu.insert('paragraph', { text: 'meant to be first' }, null, 0)
    await nabu.commit()
    expect(all(nabu).map((b) => b.text)).toEqual(['first', 'meant to be first'])
  })
})
