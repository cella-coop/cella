import type { LoroDoc } from 'loro-crdt'
import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { atomic, childrenOf, kinds, marks, node, propsOf, type Kind, type TreeID } from './blocks.ts'
import { runs, type Run } from './edits.ts'

// A document's canonical form: `{ blocks, v: 1 }`, each block in reading
// order with its type, the props its type keeps, its text as runs with
// their marks, and its children. Block ids are left out, so documents
// that read the same hash the same however they were made; empty runs
// and children are left out, so absence has one spelling. A version is
// named by the BLAKE3 of its JCS bytes, which the database computes from
// its Loro snapshot (`cella.document_canonical`, in Rust); this one is the
// browser's preview of it and must agree byte for byte, which the
// feat's slice tests check.
export type Canon = { v: 1; blocks: Block[] }
export type Block = { type: Kind; runs?: Run[]; children?: Block[] } & Record<string, unknown>

const safe = Number.MAX_SAFE_INTEGER

// A prop's or a mark's value: null, a boolean, a safe integer or a
// string; anything else has no canonical spelling, as in Rust.
function value(v: unknown): unknown {
  if (v === null || typeof v === 'boolean' || typeof v === 'string') {
    return v
  }
  if (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= safe) {
    return v
  }
  throw new Error(`no canonical form: ${typeof v === 'number' ? 'a number that is not a safe integer' : `a ${typeof v} value`}`)
}

function block(doc: LoroDoc, id: TreeID): Block {
  const data = node(doc, id).data
  const type = (data.get('type') ?? 'paragraph') as Kind
  if (typeof type !== 'string' || !kinds.includes(type)) {
    throw new Error(`no canonical form: unknown block type ${JSON.stringify(type)}`)
  }
  const b: Block = { type }
  for (const key of propsOf[type]) {
    const v = data.get(key)
    if (v !== undefined) {
      b[key] = value(v)
    }
  }
  if (!atomic.has(type)) {
    const t = data.get('text')
    if (!t || typeof t !== 'object' || !('sliceDelta' in t)) {
      throw new Error('no canonical form: a block holds no text')
    }
    const rs = runs(t as Parameters<typeof runs>[0]).filter((r) => r.text !== '')
    for (const r of rs) {
      for (const m of marks) {
        if (r.marks?.[m] !== undefined) {
          value(r.marks[m])
        }
      }
    }
    if (rs.length) {
      b.runs = rs
    }
  }
  const kids = childrenOf(doc, id).map((c) => block(doc, c.id))
  if (kids.length) {
    b.children = kids
  }
  return b
}

export function canonical(doc: LoroDoc): Canon {
  return { v: 1, blocks: childrenOf(doc, undefined).map((n) => block(doc, n.id)) }
}

// RFC 8785 (JCS): keys sorted by UTF-16 code units, which is what
// Array.sort compares; strings and numbers as ECMAScript's JSON.stringify
// writes them, which is what JCS prescribes; no whitespace.
export function jcs(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new Error('JCS has no spelling for a non-finite number')
    }
    if (v === undefined || typeof v === 'function' || typeof v === 'bigint' || typeof v === 'symbol') {
      throw new Error(`JCS has no spelling for ${typeof v}`)
    }
    return JSON.stringify(v)
  }
  if (Array.isArray(v)) {
    return `[${v.map(jcs).join(',')}]`
  }
  const o = v as Record<string, unknown>
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(o[k])}`).join(',')}}`
}

export function bytes(doc: LoroDoc): Uint8Array {
  return new TextEncoder().encode(jcs(canonical(doc)))
}

// The version's name: BLAKE3 of the canonical bytes, hex, as `b3sum`
// computes it.
export function hash(doc: LoroDoc): string {
  return bytesToHex(blake3(bytes(doc)))
}

// A canonical document's text as a reader sees it, each text block a line,
// as `cella.document_text` gives it.
export function plain(c: Canon): string {
  const out: string[] = []
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (!atomic.has(b.type)) {
        out.push((b.runs ?? []).map((r) => r.text).join(''))
      }
      walk(b.children ?? [])
    }
  }
  walk(c.blocks)
  return out.join('\n')
}
