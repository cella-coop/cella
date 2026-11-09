// Core body's model alone, no database: the edits on a tree of blocks,
// their marks, the canonical form, the outline fixtures are written in,
// patching one version into the next, and three peers converging. Run by
// `cella test slice body`.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { LoroDoc } from 'loro-crdt'
import { createDoc, kind, order, props, text, tree, type TreeID } from '../src/models/blocks.ts'
import { create, fragment, indent, insert, merge, move, outdent, paste, patch, retype, runs, shift, split, toggle } from '../src/models/edits.ts'
import { bytes, canonical, hash, jcs, plain } from '../src/models/canonical.ts'
import { anchor } from '../src/models/anchor.ts'
import { outline } from '../src/models/outline.ts'
import { edit, rateCard, rng, seeded, sync } from './random.ts'

function doc3() {
  const doc = createDoc(1)
  const a = create(doc, undefined, 0, 'paragraph', {}, [{ text: 'alpha' }])
  const b = create(doc, undefined, 1, 'paragraph', {}, [{ text: 'beta' }])
  const c = create(doc, undefined, 2, 'paragraph', {}, [{ text: 'gamma' }])
  doc.commit()
  return { doc, a, b, c }
}

const shape = (doc: LoroDoc) => order(doc).map((r) => `${'  '.repeat(r.depth)}${text(doc, r.id).toString()}`)

describe('split and merge', () => {
  it('splits at the caret, carrying marks', () => {
    const doc = createDoc(1)
    const a = create(doc, undefined, 0, 'heading', { level: 2 }, [{ text: 'hello ' }, { text: 'bold', marks: { bold: true } }])
    const b = split(doc, a, 8)
    assert.equal(text(doc, a).toString(), 'hello bo')
    assert.deepEqual(runs(text(doc, b)), [{ text: 'ld', marks: { bold: true } }])
    assert.equal(kind(doc, b), 'paragraph')
    assert.deepEqual(shape(doc), ['hello bo', 'ld'])
  })

  it('keeps identity when split at the start', () => {
    const { doc, a } = doc3()
    assert.equal(split(doc, a, 0), a)
    assert.deepEqual(shape(doc), ['', 'alpha', 'beta', 'gamma'])
  })

  it('splits a parent into its first child', () => {
    const { doc, a, b } = doc3()
    indent(doc, b)
    const n = split(doc, a, 5)
    assert.deepEqual(shape(doc), ['alpha', '  ', '  beta', 'gamma'])
    assert.equal(order(doc)[1].id, n)
  })

  it('merges text, marks and children into the previous block', () => {
    const { doc, a, b, c } = doc3()
    toggle(text(doc, b), 0, 2, 'bold')
    indent(doc, c)
    assert.equal(merge(doc, a, b), 5)
    assert.deepEqual(runs(text(doc, a)), [{ text: 'alpha' }, { text: 'be', marks: { bold: true } }, { text: 'ta' }])
    assert.deepEqual(shape(doc), ['alphabeta', '  gamma'])
  })

  it('merges a parent with its first child, keeping the grandchildren in place', () => {
    const { doc, a, b, c } = doc3()
    const d = create(doc, undefined, 3, 'paragraph', {}, [{ text: 'delta' }])
    indent(doc, b)
    indent(doc, c)
    indent(doc, c)
    indent(doc, d)
    assert.deepEqual(shape(doc), ['alpha', '  beta', '    gamma', '  delta'])
    merge(doc, a, b)
    assert.deepEqual(shape(doc), ['alphabeta', '  gamma', '  delta'])
  })
})

describe('nesting and moving', () => {
  it('indents under the previous sibling and refuses the first', () => {
    const { doc, a, b, c } = doc3()
    assert.equal(indent(doc, a), false)
    indent(doc, b)
    indent(doc, c)
    assert.deepEqual(shape(doc), ['alpha', '  beta', '  gamma'])
    indent(doc, c)
    assert.deepEqual(shape(doc), ['alpha', '  beta', '    gamma'])
  })

  it('outdents and adopts the following siblings', () => {
    const { doc, a, b, c } = doc3()
    indent(doc, b)
    indent(doc, c)
    indent(doc, c)
    outdent(doc, c)
    assert.deepEqual(shape(doc), ['alpha', '  beta', '  gamma'])
    outdent(doc, b)
    assert.deepEqual(shape(doc), ['alpha', 'beta', '  gamma'])
    assert.equal(outdent(doc, a), false)
  })

  it('moves before, after and into, never into its own subtree', () => {
    const { doc, a, b, c } = doc3()
    move(doc, c, { before: a })
    assert.deepEqual(shape(doc), ['gamma', 'alpha', 'beta'])
    move(doc, c, { after: b })
    assert.deepEqual(shape(doc), ['alpha', 'beta', 'gamma'])
    move(doc, a, { into: b })
    assert.deepEqual(shape(doc), ['beta', '  alpha', 'gamma'])
    assert.equal(move(doc, b, { into: a }), false)
  })
})

describe('marks and kinds', () => {
  it('toggles marks over a range', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    assert.equal(toggle(t, 0, 3, 'italic'), true)
    assert.equal(toggle(t, 1, 2, 'italic'), false)
    assert.deepEqual(runs(t), [{ text: 'a', marks: { italic: true } }, { text: 'l' }, { text: 'p', marks: { italic: true } }, { text: 'ha' }])
    toggle(t, 0, 5, 'link', 'https://x.example')
    assert.ok(runs(t).every((r) => r.marks?.link === 'https://x.example'))
  })

  it('expands bold after but not links', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    toggle(t, 0, 5, 'bold')
    insert(t, 5, '!')
    assert.deepEqual(runs(t), [{ text: 'alpha!', marks: { bold: true } }])
    toggle(t, 0, 6, 'bold')
    toggle(t, 0, 6, 'link', 'https://x.example')
    insert(t, 6, '?')
    assert.deepEqual(runs(t).at(-1), { text: '?' })
  })

  it('inserts with explicit marks overriding expansion', () => {
    const { doc, a } = doc3()
    const t = text(doc, a)
    toggle(t, 0, 5, 'bold')
    insert(t, 5, 'x', {})
    assert.deepEqual(runs(t), [{ text: 'alpha', marks: { bold: true } }, { text: 'x' }])
  })

  it('retypes and drops props the new kind does not keep', () => {
    const { doc, a } = doc3()
    retype(doc, a, 'todo', { checked: true })
    assert.deepEqual(props(doc, a), { checked: true })
    retype(doc, a, 'heading', { level: 3 })
    assert.deepEqual(props(doc, a), { level: 3 })
    assert.equal(tree(doc).getNodeByID(a)?.data.get('checked'), undefined)
  })
})

describe('the canonical form', () => {
  it('serialises per JCS', () => {
    assert.equal(jcs({ b: 1, a: [true, null, 'x'], c: { z: 1.5, y: 'é\n' } }), '{"a":[true,null,"x"],"b":1,"c":{"y":"é\\n","z":1.5}}')
    assert.equal(jcs({ é: 1, z: 2, '\u{1F600}': 3, '€': 4 }), '{"z":2,"é":1,"€":4,"😀":3}')
    assert.equal(jcs(1e21), '1e+21')
    assert.equal(jcs(-0), '0')
  })

  it('orders blocks, sorts marks and omits empties', () => {
    const { doc, a, b } = doc3()
    toggle(text(doc, a), 0, 2, 'italic')
    toggle(text(doc, a), 0, 2, 'bold')
    indent(doc, b)
    retype(doc, a, 'heading', { level: 1 })
    doc.commit()
    assert.equal(
      new TextDecoder().decode(bytes(doc)),
      '{"blocks":[{"children":[{"runs":[{"text":"beta"}],"type":"paragraph"}],"level":1,"runs":[{"marks":{"bold":true,"italic":true},"text":"al"},{"text":"pha"}],"type":"heading"},{"runs":[{"text":"gamma"}],"type":"paragraph"}],"v":1}',
    )
  })

  it('names an embed by its kind and ref, and holds no text for it', () => {
    const doc = createDoc(1)
    const e = create(doc, undefined, 0, 'embed', { embed: 'motion', ref: 'm-2026-011' })
    text(doc, e).insert(0, 'ignored')
    doc.commit()
    assert.equal(jcs(canonical(doc)), '{"blocks":[{"embed":"motion","ref":"m-2026-011","type":"embed"}],"v":1}')
  })

  it('refuses what has no canonical spelling', () => {
    const doc = createDoc(1)
    const h = create(doc, undefined, 0, 'heading', { level: 1.5 })
    doc.commit()
    assert.throws(() => canonical(doc), /not a safe integer/)
    tree(doc).getNodeByID(h)?.data.set('type', 'table')
    assert.throws(() => canonical(doc), /unknown block type "table"/)
  })

  it('hashes the same document the same on every peer, however it was made', () => {
    const one = seeded(1)
    const two = createDoc(2)
    two.import(one.export({ mode: 'snapshot' }))
    const three = seeded(3)
    assert.equal(hash(two), hash(one))
    assert.equal(hash(three), hash(one))
    assert.equal(hash(one), bytesToHex(blake3(bytes(one))))
    assert.match(hash(one), /^[0-9a-f]{64}$/)
  })

  it('round-trips a fragment, and reads as plain text block by block', () => {
    const one = seeded(1)
    const two = createDoc(2)
    paste(two, undefined, 0, tree(one).roots().map((n) => fragment(one, n.id as TreeID)))
    assert.deepEqual(canonical(two), canonical(one))
    assert.equal(plain(canonical(one)).split('\n')[0], 'Rate card 2027')
  })
})

describe('outlines, patches and anchors', () => {
  it('reads an outline into a tree, and refuses one that does not nest', () => {
    const fs = outline([{ type: 'heading', level: 1, text: 'T' }, { type: 'bullet', text: 'a' }, { type: 'bullet', depth: 1, runs: [{ text: 'b', bold: true }] }])
    assert.deepEqual(fs[1].children, [{ type: 'bullet', runs: [{ text: 'b', marks: { bold: true } }], children: [] }])
    assert.throws(() => outline([{ text: 'a', depth: 1 }]), /does not nest/)
    assert.throws(() => outline([{ type: 'divider', text: 'x' }]), /holds no text/)
    assert.throws(() => outline([{ type: 'heading', text: 'x' }]), /level is 1, 2 or 3/)
    assert.throws(() => outline([{ runs: [{ text: 'x', underline: true }] }]), /no mark underline/)
  })

  it('patches one version into the next, keeping the blocks that did not change', () => {
    const doc = createDoc(1)
    patch(doc, undefined, rateCard)
    doc.commit()
    const before = new Map(order(doc).map((r) => [text(doc, r.id).toString(), r.id]))
    const next = structuredClone(rateCard)
    next[3].children[0].runs = [{ text: 'Standard: 580 €' }]
    next.splice(4, 0, { type: 'quote', runs: [{ text: 'New' }], children: [] })
    patch(doc, undefined, next)
    doc.commit()
    const fresh = createDoc(2)
    paste(fresh, undefined, 0, next)
    assert.equal(jcs(canonical(doc)), jcs(canonical(fresh)))
    const after = new Map(order(doc).map((r) => [text(doc, r.id).toString(), r.id]))
    assert.equal(after.get('Solidarity: 380 €'), before.get('Solidarity: 380 €'))
    assert.equal(after.get('Standard: 580 €'), before.get('Standard: 560 €'), 'a changed block keeps its identity')
  })

  it('anchors a quote by cursors that find it after the text around it moves', () => {
    const doc = seeded(1)
    const a = anchor(doc, 'Solidarity: 380')
    assert.ok(a)
    assert.equal(anchor(doc, 'no such words'), null)
    const t = text(doc, a.block)
    t.insert(0, 'Was: ')
    doc.commit()
    assert.ok(t.toString().startsWith('Was: Solidarity'))
  })
})

describe('caret through a remote delta', () => {
  it('moves with edits before it and holds against edits at or after it', () => {
    assert.equal(shift(4, [{ insert: 'NB: ' }]), 8)
    assert.equal(shift(4, [{ retain: 4 }, { insert: 'x' }]), 4)
    assert.equal(shift(4, [{ retain: 1 }, { delete: 2 }]), 2)
    assert.equal(shift(4, [{ retain: 2 }, { delete: 5 }]), 2)
    assert.equal(shift(4, [{ retain: 6 }, { delete: 1 }]), 4)
  })
})

describe('convergence', () => {
  it('three peers editing concurrently reach the same canonical bytes', () => {
    const snapshot = seeded().export({ mode: 'snapshot' })
    for (let i = 0; i < 300; i++) {
      const r = rng(i + 1)
      const peers = [1, 2, 3].map((p) => {
        const d = createDoc(BigInt(i * 10 + p))
        d.import(snapshot)
        return d
      })
      for (let round = 1 + r.int(4); round > 0; round--) {
        for (const d of peers) {
          for (let k = 1 + r.int(5); k > 0; k--) {
            edit(d, r)
            d.commit()
          }
        }
        // Partial gossip: some pairs exchange, in a random order.
        for (let k = r.int(4); k > 0; k--) {
          sync(r.pick(peers), r.pick(peers))
        }
      }
      // A full exchange, in a random order of pairs, twice over.
      const pairs = peers.flatMap((a) => peers.filter((b) => b !== a).map((b) => [a, b] as const))
      for (let pass = 0; pass < 2; pass++) {
        for (const [a, b] of pairs.sort(() => r.next() - 0.5)) {
          sync(a, b)
        }
      }
      const out = peers.map((d) => jcs(canonical(d)))
      assert.equal(out[1], out[0], `seed ${i + 1}`)
      assert.equal(out[2], out[0], `seed ${i + 1}`)
    }
  })
})
