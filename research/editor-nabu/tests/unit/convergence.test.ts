import type { Nabu } from '@aionbuilders/nabu'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { canonical } from '../../src/lib/canonical.ts'
import { seed } from '../../src/lib/seed.ts'
import { engine } from '../../src/lib/editor/engine.ts'
import { all, ev, sel } from './helpers.ts'

// Three peers start from the rate card and apply nabu's own operations at
// random, exchanging updates in a random order while they edit; after a
// final exchange every peer must hold the same canonical JSON. Loro
// guarantees the merge; this checks that nabu's compound edits (a split is
// a delete, a node creation and an insert) and our canonical form keep it.
// It also counts structures nabu would not create itself.

const kinds = ['type', 'delete', 'split', 'merge', 'mark', 'indent', 'outdent', 'retype', 'move', 'check', 'drop', 'sync', 'sync'] as const
type Op = { peer: number; kind: (typeof kinds)[number]; x: number; y: number; s: string }

const op = fc.record({
  peer: fc.nat(2),
  kind: fc.constantFrom(...kinds),
  x: fc.nat(10_000),
  y: fc.nat(10_000),
  s: fc.constantFrom('a', 'é', ' ', '€', '🙂', 'xyz', '\n'),
})

const pick = <T>(xs: T[], n: number): T | undefined => (xs.length ? xs[n % xs.length] : undefined)
const texts = (nabu: Nabu) => all(nabu).filter((b) => b.behaviors?.has('text'))

function sync(from: Nabu, to: Nabu) {
  to.doc.import(from.doc.export({ mode: 'update', from: to.doc.oplogVersion() }))
}

async function apply(peers: Nabu[], o: Op) {
  const nabu = peers[o.peer]
  const b = pick(texts(nabu), o.x)
  const len = b?.text.length ?? 0
  let at = len ? o.y % (len + 1) : 0
  // A caret never sits inside a surrogate pair.
  if (at > 0 && at < len && /[\uDC00-\uDFFF]/.test(b.text[at])) {
    at--
  }
  switch (o.kind) {
    case 'type':
      b?.behavior.insert(at, o.s)
      break
    case 'delete':
      if (len) {
        const from = Math.min(at, len - 1)
        let to = Math.min(len, from + 1 + (o.x % 3))
        if (to < len && /[\uDC00-\uDFFF]/.test(b.text[to])) {
          to++
        }
        b.behavior.delete({ index: /[\uDC00-\uDFFF]/.test(b.text[from]) ? from - 1 : from, length: to - from })
      }
      break
    case 'split':
      b?.behavior.handleInsertParagraph(ev('insertParagraph'), sel(at))
      break
    case 'merge':
      b?.behavior.handleDeleteContentBackward(ev('deleteContentBackward'), sel(0))
      break
    case 'mark': {
      const mark = pick(['bold', 'italic', 'code', 'link'], o.y)!
      if (len) {
        b.behavior.toggleMark(mark, mark === 'link' ? 'https://x.example' : true, sel(Math.min(at, len - 1), len))
      }
      break
    }
    case 'indent':
    case 'outdent': {
      const item = pick(all(nabu).filter((x) => x.type === 'list-item'), o.x)
      item?.keydown({ key: 'Tab', shiftKey: o.kind === 'outdent', preventDefault() {} })
      break
    }
    case 'retype':
      if (b && b.type !== 'list-item') {
        const [type, props] = pick<[string, object]>([['heading', { level: 1 + (o.y % 3) }], ['paragraph', {}], ['blockquote', {}]], o.y)!
        b.transformTo(type, props)
      }
      break
    case 'move': {
      const roots = nabu.children as any[]
      const a = pick(roots, o.x)
      const c = pick(roots, o.y)
      if (a && c && a !== c) {
        a.node.moveAfter(c.node)
      }
      break
    }
    case 'check': {
      const item = pick(all(nabu).filter((x) => x.type === 'list-item'), o.x)
      item?.setChecked(!item.checked)
      break
    }
    case 'drop': {
      const roots = nabu.children as any[]
      if (roots.length > 1) {
        nabu.tree.delete(pick(roots, o.x).node.id)
      }
      break
    }
    case 'sync':
      sync(nabu, peers[(o.peer + 1 + (o.x % 2)) % 3])
      return
  }
  await nabu.commit()
}

// Structures a list should never take: an item outside a list, a list with
// no items, or a block other than an item directly inside a list. nabu
// itself leaves an empty sublist behind when Shift-Tab lifts a sublist's
// only item, which is where the empty lists counted here come from.
function oddities(nabu: Nabu): string[] {
  const out: string[] = []
  const walk = (nodes: any[], parent: string | null) => {
    for (const n of nodes) {
      const type = n.data.get('type')
      if (type === 'list-item' && parent !== 'list') {
        out.push(`item under ${parent ?? 'root'}`)
      }
      if (parent === 'list' && type !== 'list-item') {
        out.push(`${type} in a list`)
      }
      if (type === 'list' && !(n.children() ?? []).length) {
        out.push('empty list')
      }
      walk(n.children() ?? [], type)
    }
  }
  walk(nabu.tree.roots(), null)
  return out
}

describe('convergence', () => {
  for (const [name, peers] of [['three peers', 3], ['one peer', 1]] as const) {
  it(`${name}: every peer reaches the same canonical JSON after any exchange order`, async () => {
    const snapshot = seed()
    const tally = { runs: 0, ops: 0, threw: 0, odd: 0, kinds: new Map<string, number>(), errors: new Map<string, number>() }
    await fc.assert(
      fc.asyncProperty(fc.array(op, { minLength: 5, maxLength: 40 }), async (raw) => {
        const ops = raw.map((o) => (peers === 1 ? { ...o, peer: 0 } : o))
        const nodes = [0, 1, 2].map(() => engine(snapshot))
        for (const o of ops) {
          try {
            await apply(nodes, o)
          } catch (e) {
            // A throw mid-edit leaves a half-done transaction; it still
            // has to merge.
            tally.threw++
            const k = `${o.kind}: ${String(e).slice(0, 80)}`
            tally.errors.set(k, (tally.errors.get(k) ?? 0) + 1)
          }
          tally.ops++
        }
        for (let round = 0; round < 2; round++) {
          for (const from of nodes) {
            for (const to of nodes) {
              if (from !== to) {
                sync(from, to)
              }
            }
          }
        }
        const forms = nodes.map((p) => canonical(p.doc))
        tally.runs++
        const odd = oddities(nodes[0])
        if (odd.length) {
          tally.odd++
          for (const k of odd) {
            tally.kinds.set(k, (tally.kinds.get(k) ?? 0) + 1)
          }
        }
        expect(forms[1]).toBe(forms[0])
        expect(forms[2]).toBe(forms[0])
      }),
      { numRuns: 500 },
    )
    console.log(
      `convergence, ${name}: ${tally.runs} runs, ${tally.ops} ops, ${tally.threw} threw, ${tally.odd} runs ended with odd structure:`,
      Object.fromEntries(tally.kinds),
      Object.fromEntries(tally.errors),
    )
  }, 300_000)
  }
})
