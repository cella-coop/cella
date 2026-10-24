import { describe, expect, it } from 'vitest'
import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { createDoc, kind, order, props, text, tree, type TreeID } from '../src/lib/model/doc.ts'
import { create, indent, merge, move, outdent, retype, runs, split, toggle, insert, paste, fragment } from '../src/lib/model/ops.ts'
import { bytes, canonical, hash, jcs } from '../src/lib/model/canonical.ts'
import { seed } from '../src/lib/model/seed.ts'

function doc3() {
  const doc = createDoc(1)
  const a = create(doc, undefined, 0, 'paragraph', {}, [{ text: 'alpha' }])
  const b = create(doc, undefined, 1, 'paragraph', {}, [{ text: 'beta' }])
  const c = create(doc, undefined, 2, 'paragraph', {}, [{ text: 'gamma' }])
  doc.commit()
  return { doc, a, b, c }
}

const shape = (doc: ReturnType<typeof createDoc>) => order(doc).map((r) => `${'  '.repeat(r.depth)}${text(doc, r.id).toString()}`)

describe('split and merge', () => {
  it('splits at the caret, carrying marks', () => {
    const doc = createDoc(1)
    const a = create(doc, undefined, 0, 'heading', { level: 2 }, [{ text: 'hello ' }, { text: 'bold', marks: { bold: true } }])
    const b = split(doc, a, 8)
    expect(text(doc, a).toString()).toBe('hello bo')
    expect(runs(text(doc, b))).toEqual([{ text: 'ld', marks: { bold: true } }])
    expect(kind(doc, b)).toBe('paragraph')
    expect(shape(doc)).toEqual(['hello bo', 'ld'])
  })

  it('keeps identity when split at the start', () => {
    const { doc, a } = doc3()
    expect(split(doc, a, 0)).toBe(a)
    expect(shape(doc)).toEqual(['', 'alpha', 'beta', 'gamma'])
  })

  it('splits a parent into its first child', () => {
    const { doc, a, b } = doc3()
    indent(doc, b)
    const n = split(doc, a, 5)
    expect(shape(doc)).toEqual(['alpha', '  ', '  beta', 'gamma'])
    expect(order(doc)[1].id).toBe(n)
  })

  it('merges text, marks and children into the previous block', () => {
    const { doc, a, b, c } = doc3()
    toggle(text(doc, b), 0, 2, 'bold')
    indent(doc, c)
    const at = merge(doc, a, b)
    expect(at).toBe(5)
    expect(runs(text(doc, a))).toEqual([{ text: 'alpha' }, { text: 'be', marks: { bold: true } }, { text: 'ta' }])
    expect(shape(doc)).toEqual(['alphabeta', '  gamma'])
  })
})

describe('nesting and moving', () => {
  it('indents under the previous sibling and refuses the first', () => {
    const { doc, a, b, c } = doc3()
    expect(indent(doc, a)).toBe(false)
    indent(doc, b)
    indent(doc, c)
    expect(shape(doc)).toEqual(['alpha', '  beta', '  gamma'])
    indent(doc, c)
    expect(shape(doc)).toEqual(['alpha', '  beta', '    gamma'])
  })

  it('outdents and adopts the following siblings', () => {
    const { doc, a, b, c } = doc3()
    indent(doc, b)
    indent(doc, c)
    indent(doc, c)
    outdent(doc, c)
    expect(shape(doc)).toEqual(['alpha', '  beta', '  gamma'])
    outdent(doc, b)
    expect(shape(doc)).toEqual(['alpha', 'beta', '  gamma'])
    expect(outdent(doc, a)).toBe(false)
  })

  it('moves before, after and into, never into its own subtree', () => {
    const { doc, a, b, c } = doc3()
    move(doc, c, { before: a })
    expect(shape(doc)).toEqual(['gamma', 'alpha', 'beta'])
    move(doc, c, { after: b })
    expect(shape(doc)).toEqual(['alpha', 'beta', 'gamma'])
    move(doc, a, { into: b })
    expect(shape(doc)).toEqual(['beta', '  alpha', 'gamma'])
    expect(move(doc, b, { into: a })).toBe(false)
  })
})

describe('marks and kinds', () => {
  it('toggles marks over a range', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    expect(toggle(t, 0, 3, 'italic')).toBe(true)
    expect(toggle(t, 1, 2, 'italic')).toBe(false)
    expect(runs(t)).toEqual([{ text: 'a', marks: { italic: true } }, { text: 'l' }, { text: 'p', marks: { italic: true } }, { text: 'ha' }])
    toggle(t, 0, 5, 'link', 'https://x.example')
    expect(runs(t).every((r) => r.marks?.link === 'https://x.example')).toBe(true)
  })

  it('expands bold after but not links', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    toggle(t, 0, 5, 'bold')
    insert(t, 5, '!')
    expect(runs(t)).toEqual([{ text: 'alpha!', marks: { bold: true } }])
    toggle(t, 0, 6, 'bold')
    toggle(t, 0, 6, 'link', 'https://x.example')
    insert(t, 6, '?')
    expect(runs(t).at(-1)).toEqual({ text: '?' })
  })

  it('inserts with explicit marks overriding expansion', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    toggle(t, 0, 5, 'bold')
    insert(t, 5, 'x', {})
    expect(runs(t)).toEqual([{ text: 'alpha', marks: { bold: true } }, { text: 'x' }])
  })

  it('retypes and drops props the new kind does not keep', () => {
    const { doc, a } = doc3()
    retype(doc, a, 'todo', { checked: true })
    expect(props(doc, a)).toEqual({ checked: true })
    retype(doc, a, 'heading', { level: 3 })
    expect(props(doc, a)).toEqual({ level: 3 })
    expect(tree(doc).getNodeByID(a)?.data.get('checked')).toBeUndefined()
  })
})

describe('canonical form', () => {
  it('serialises per JCS', () => {
    expect(jcs({ b: 1, a: [true, null, 'x'], c: { z: 1.5, y: 'é\n' } })).toBe('{"a":[true,null,"x"],"b":1,"c":{"y":"é\\n","z":1.5}}')
    expect(jcs({ 'é': 1, z: 2, '\u{1F600}': 3, '€': 4 })).toBe('{"z":2,"é":1,"€":4,"😀":3}')
    expect(jcs(1e21)).toBe('1e+21')
    expect(jcs(-0)).toBe('0')
  })

  it('orders blocks, sorts marks and omits empties', () => {
    const { doc, a, b } = doc3()
    toggle(text(doc, a), 0, 2, 'italic')
    toggle(text(doc, a), 0, 2, 'bold')
    indent(doc, b)
    retype(doc, a, 'heading', { level: 1 })
    doc.commit()
    expect(new TextDecoder().decode(bytes(doc))).toBe(
      '{"blocks":[{"children":[{"runs":[{"text":"beta"}],"type":"paragraph"}],"level":1,"runs":[{"marks":{"bold":true,"italic":true},"text":"al"},{"text":"pha"}],"type":"heading"},{"runs":[{"text":"gamma"}],"type":"paragraph"}],"v":1}',
    )
  })

  it('hashes the same document the same on every peer, however it was made', () => {
    const one = createDoc(1)
    seed(one)
    const two = createDoc(2)
    two.import(one.export({ mode: 'snapshot' }))
    const three = createDoc(3)
    seed(three)
    expect(hash(two)).toBe(hash(one))
    expect(hash(three)).toBe(hash(one))
    expect(hash(one)).toBe(bytesToHex(blake3(bytes(one))))
    expect(hash(one)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('round-trips a fragment', () => {
    const one = createDoc(1)
    seed(one)
    const two = createDoc(2)
    paste(two, undefined, 0, tree(one).roots().map((n) => fragment(one, n.id as TreeID)))
    expect(canonical(two)).toEqual(canonical(one))
  })
})
