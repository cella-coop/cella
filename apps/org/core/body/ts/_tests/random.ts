// Random documents for the slice tests: a seeded generator, the rate card
// as fragments, and one random edit of every kind the editor makes.

import type { LoroDoc, LoroText } from 'loro-crdt'
import { atomic, createDoc, kind, kinds, order, text, type TreeID } from '../src/models/blocks.ts'
import * as ops from '../src/models/edits.ts'

// Mulberry32: a small seeded PRNG, so a failure names its seed.
export function rng(seed: number) {
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

export type R = ReturnType<typeof rng>

// Words that test the canonical spelling: escapes, control characters,
// astral and combining characters, the line separators JSON leaves as is.
export const words = ['a', 'é', 'lantern ', '€', '😀', 'coop', '\n', 'rate', '"q"', '\\', '\t', '\u0001', ' ', 'é', '</', '\u007f']

const p = (...rs: (string | ops.Run)[]): ops.Run[] => rs.map((r) => (typeof r === 'string' ? { text: r } : r))
const b = (t: string): ops.Run => ({ text: t, marks: { bold: true } })

export const rateCard: ops.Fragment[] = [
  { type: 'heading', level: 1, runs: p('Rate card 2027'), children: [] },
  {
    type: 'paragraph',
    runs: p('Day rates for ', { text: '2027', marks: { italic: true } }, '. Small coops pay the ', b('solidarity'), ' rate.'),
    children: [],
  },
  { type: 'embed', embed: 'motion', ref: 'm-2026-011', runs: [], children: [] },
  {
    type: 'bullet',
    runs: p(b('Day of work'), ' — per day'),
    children: [
      { type: 'bullet', runs: p('Standard: 560 €'), children: [] },
      { type: 'bullet', runs: p('Solidarity: 380 €'), children: [] },
    ],
  },
  { type: 'divider', runs: [], children: [] },
  { type: 'todo', checked: true, runs: p('Add the ', { text: 'Online shop', marks: { code: true } }, ' line'), children: [] },
  { type: 'numbered', runs: p('The general meeting ', { text: 'decides', marks: { link: 'https://corpus.pub' } }), children: [] },
  { type: 'code', language: 'toml', runs: p('[rate]\nday = 560'), children: [] },
]

export function seeded(peer: number | bigint = 100): LoroDoc {
  const doc = createDoc(peer)
  ops.paste(doc, undefined, 0, rateCard)
  doc.commit({ origin: 'seed' })
  return doc
}

function textual(doc: LoroDoc): TreeID[] {
  return order(doc)
    .map((r) => r.id)
    .filter((id) => !atomic.has(kind(doc, id)))
}

// A random caret in a text, on a code point boundary, as the editor snaps.
function pos(t: LoroText, r: R): number {
  return ops.snap(t.toString(), r.int(t.length + 1))
}

// One random edit, of every kind the editor makes.
export function edit(doc: LoroDoc, r: R): void {
  const rows = order(doc)
  const ids = rows.map((x) => x.id)
  const texts = textual(doc)
  if (!ids.length) {
    ops.create(doc, undefined, 0, 'paragraph')
    return
  }
  switch (r.int(11)) {
    case 0:
    case 1: {
      if (texts.length) {
        const t = text(doc, r.pick(texts))
        ops.insert(t, pos(t, r), r.pick(words))
      }
      return
    }
    case 2: {
      if (texts.length) {
        const t = text(doc, r.pick(texts))
        const a = pos(t, r)
        const z = pos(t, r)
        ops.remove(t, Math.min(a, z), Math.abs(a - z))
      }
      return
    }
    case 3: {
      if (texts.length) {
        const t = text(doc, r.pick(texts))
        const a = pos(t, r)
        const z = pos(t, r)
        const key = r.pick(['bold', 'italic', 'code', 'link'] as const)
        ops.toggle(t, Math.min(a, z), Math.max(a, z), key, key === 'link' ? r.pick(['https://a.example', 'https://b.example/"x"?é']) : true)
      }
      return
    }
    case 4: {
      if (texts.length) {
        const id = r.pick(texts)
        ops.split(doc, id, pos(text(doc, id), r))
      }
      return
    }
    case 5: {
      const i = r.int(rows.length)
      const id = rows[i].id
      const prev = rows[i - 1]?.id
      if (prev && !atomic.has(kind(doc, prev)) && !atomic.has(kind(doc, id))) {
        ops.merge(doc, prev, id)
      }
      return
    }
    case 6: {
      const place: ops.Place = r.pick([{ before: r.pick(ids) }, { after: r.pick(ids) }, { into: r.pick(ids) }])
      ops.move(doc, r.pick(ids), place)
      return
    }
    case 7:
      ops.indent(doc, r.pick(ids))
      return
    case 8:
      ops.outdent(doc, r.pick(ids))
      return
    case 9: {
      const k = r.pick(kinds)
      ops.retype(doc, r.pick(ids), k, { level: 1 + r.int(3), checked: r.next() < 0.5, language: r.pick(['toml', 'sql']), embed: 'motion', ref: r.pick(['m-2026-011', 'm-2026-007']) })
      return
    }
    default:
      if (r.next() < 0.5 && ids.length > 3) {
        ops.drop(doc, r.pick(ids))
      } else {
        ops.after(doc, r.pick(ids), r.pick(kinds), {}, [{ text: r.pick(words) }])
      }
  }
}

export function sync(from: LoroDoc, to: LoroDoc): void {
  to.import(from.export({ mode: 'update', from: to.oplogVersion() }))
}
