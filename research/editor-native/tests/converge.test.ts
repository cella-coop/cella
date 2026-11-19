import { describe, expect, it } from 'vitest'
import type { LoroDoc, LoroText } from 'loro-crdt'
import { atomic, createDoc, kind, kinds, order, text, type TreeID } from '../src/lib/model/doc.ts'
import { after, create, drop, indent, insert, merge, move, outdent, remove, retype, snap, split, toggle, type Place } from '../src/lib/model/ops.ts'
import { canonical, jcs } from '../src/lib/model/canonical.ts'
import { seed } from '../src/lib/model/seed.ts'

// Mulberry32: a small seeded PRNG, so a failure names its iteration.
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number) => Math.floor(next() * n)
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)]
  return { next, int, pick }
}

type R = ReturnType<typeof rng>

const words = ['a', 'é', 'lantern ', '€', '😀', 'coop', '\n', 'rate']

function textual(doc: LoroDoc): TreeID[] {
  return order(doc)
    .map((r) => r.id)
    .filter((id) => !atomic.has(kind(doc, id)))
}

// A random caret in a text, on a code point boundary, as the editor snaps.
function pos(t: LoroText, r: R): number {
  return snap(t.toString(), r.int(t.length + 1))
}

// One random edit, of every kind the editor makes.
function edit(doc: LoroDoc, r: R): void {
  const rows = order(doc)
  const ids = rows.map((x) => x.id)
  const texts = textual(doc)
  const op = r.int(11)
  if (!ids.length) {
    create(doc, undefined, 0, 'paragraph')
    return
  }
  switch (op) {
    case 0:
    case 1: {
      if (!texts.length) {
        return
      }
      const t = text(doc, r.pick(texts))
      insert(t, pos(t, r), r.pick(words))
      return
    }
    case 2: {
      if (!texts.length) {
        return
      }
      const t = text(doc, r.pick(texts))
      const a = pos(t, r)
      const b = pos(t, r)
      remove(t, Math.min(a, b), Math.abs(a - b))
      return
    }
    case 3: {
      if (!texts.length) {
        return
      }
      const t = text(doc, r.pick(texts))
      const a = pos(t, r)
      const b = pos(t, r)
      const key = r.pick(['bold', 'italic', 'code', 'link'] as const)
      toggle(t, Math.min(a, b), Math.max(a, b), key, key === 'link' ? r.pick(['https://a.example', 'https://b.example']) : true)
      return
    }
    case 4: {
      if (!texts.length) {
        return
      }
      const id = r.pick(texts)
      split(doc, id, pos(text(doc, id), r))
      return
    }
    case 5: {
      const i = r.int(rows.length)
      const id = rows[i].id
      const prev = rows[i - 1]?.id
      if (prev && !atomic.has(kind(doc, prev)) && !atomic.has(kind(doc, id))) {
        merge(doc, prev, id)
      }
      return
    }
    case 6: {
      const place: Place = r.pick([{ before: r.pick(ids) }, { after: r.pick(ids) }, { into: r.pick(ids) }])
      move(doc, r.pick(ids), place)
      return
    }
    case 7:
      indent(doc, r.pick(ids))
      return
    case 8:
      outdent(doc, r.pick(ids))
      return
    case 9: {
      const k = r.pick(kinds)
      retype(doc, r.pick(ids), k, { level: 1 + r.int(3), checked: r.next() < 0.5, language: 'toml', decision: 'd-2026-011' })
      return
    }
    default:
      if (r.next() < 0.5 && ids.length > 3) {
        drop(doc, r.pick(ids))
      } else {
        after(doc, r.pick(ids), r.pick(kinds), {}, [{ text: r.pick(words) }])
      }
  }
}

function sync(from: LoroDoc, to: LoroDoc): void {
  to.import(from.export({ mode: 'update', from: to.oplogVersion() }))
}

describe('convergence', () => {
  it('three peers editing concurrently reach the same canonical bytes', () => {
    const base = createDoc(100)
    seed(base)
    const snapshot = base.export({ mode: 'snapshot' })
    const iterations = 600
    let checked = 0
    for (let i = 0; i < iterations; i++) {
      const r = rng(i + 1)
      const peers = [1, 2, 3].map((p) => {
        const d = createDoc(BigInt(i * 10 + p))
        d.import(snapshot)
        return d
      })
      const rounds = 1 + r.int(4)
      for (let round = 0; round < rounds; round++) {
        for (const d of peers) {
          const n = 1 + r.int(5)
          for (let k = 0; k < n; k++) {
            edit(d, r)
            d.commit()
          }
        }
        // Partial gossip: some pairs exchange, in a random order.
        for (let k = r.int(4); k > 0; k--) {
          sync(r.pick(peers), r.pick(peers))
        }
      }
      // Full exchange, in a random order of pairs, twice over to close it.
      const pairs = peers.flatMap((a) => peers.filter((b) => b !== a).map((b) => [a, b] as const))
      for (let pass = 0; pass < 2; pass++) {
        for (const [a, b] of pairs.sort(() => r.next() - 0.5)) {
          sync(a, b)
        }
      }
      const out = peers.map((d) => jcs(canonical(d)))
      if (out[0] !== out[1] || out[1] !== out[2]) {
        throw new Error(`diverged at iteration ${i}:\n${out.join('\n')}`)
      }
      const vv = peers.map((d) => [...d.oplogVersion().toJSON().entries()].sort().join())
      expect(vv[1]).toBe(vv[0])
      expect(vv[2]).toBe(vv[0])
      checked++
    }
    expect(checked).toBe(iterations)
  }, 120_000)
})
