import { LoroDoc, LoroText } from 'loro-crdt'
import { describe, expect, it } from 'vitest'
import { canonical, hash, jcs } from '../../src/lib/canonical.ts'
import { seed, styles } from '../../src/lib/seed.ts'
import { make, t } from './helpers.ts'

describe('JCS', () => {
  it('sorts keys by code unit at every depth and drops whitespace', () => {
    expect(jcs({ b: 1, a: [{ z: true, y: null }], é: 'x', B: 2 })).toBe('{"B":2,"a":[{"y":null,"z":true}],"b":1,"é":"x"}')
  })

  it('writes numbers and strings as RFC 8785 does', () => {
    expect(jcs([1e21, 0.1, -0, 1e-7, 'a" \u0007'])).toBe('[1e+21,0.1,0,1e-7,"a\\" \\u0007"]')
  })

  it('refuses what JSON cannot say', () => {
    expect(() => jcs(Number.NaN)).toThrow()
  })
})

describe('canonical form', () => {
  it('orders children as the tree does and runs with their marks', () => {
    const nabu = make([
      { type: 'heading', level: 1, delta: [t('Rate card')] },
      { type: 'paragraph', delta: [t('a', { link: 'x', bold: true }), t('b')] },
    ])
    expect(canonical(nabu.doc)).toBe(
      '{"blocks":[{"props":{"level":1},"text":[{"text":"Rate card"}],"type":"heading"},{"text":[{"marks":{"bold":true,"link":"x"},"text":"a"},{"text":"b"}],"type":"paragraph"}]}',
    )
  })

  it('splices list wrappers, so two adjacent lists read as one', () => {
    const one = make([{ type: 'list', listType: 'bullet', items: [{ delta: [t('a')] }, { delta: [t('b')] }] }])
    const two = make([
      { type: 'list', listType: 'bullet', items: [{ delta: [t('a')] }] },
      { type: 'list', listType: 'bullet', items: [{ delta: [t('b')] }] },
    ])
    expect(canonical(two.doc)).toBe(canonical(one.doc))
  })

  it('is the same however the state was reached', () => {
    const a = new LoroDoc()
    a.configTextStyle(styles as never)
    const na = a.getTree('blocks').createNode()
    na.data.set('type', 'paragraph')
    const ta = na.data.setContainer('text', new LoroText())
    ta.insert(0, 'ab')
    ta.mark({ start: 0, end: 2 }, 'bold', true)
    a.commit()

    const b = new LoroDoc()
    b.configTextStyle(styles as never)
    const nb = b.getTree('blocks').createNode()
    nb.data.set('type', 'paragraph')
    nb.data.set('scratch', 1)
    nb.data.delete('scratch')
    const tb = nb.data.setContainer('text', new LoroText())
    tb.insert(0, 'b')
    tb.mark({ start: 0, end: 1 }, 'bold', true)
    tb.insert(0, 'xa')
    tb.delete(0, 1)
    tb.mark({ start: 0, end: 1 }, 'bold', true)
    tb.mark({ start: 0, end: 2 }, 'italic', true)
    tb.unmark({ start: 0, end: 2 }, 'italic')
    b.commit()

    expect(canonical(b)).toBe(canonical(a))
    expect(hash(canonical(b))).toBe(hash(canonical(a)))
  })

  // The page shows the same hash's prefix in Chromium: the bytes are the
  // same in Node and in the browser.
  it('hashes the seeded rate card to a fixed value', () => {
    const doc = new LoroDoc()
    doc.import(seed())
    const json = canonical(doc)
    expect(json.length).toBe(1785)
    expect(hash(json)).toBe('c6b0f6932fcc21e3c971a6901861b5c48832cf512e0870807b3e8ad5468ab859')
  })
})
