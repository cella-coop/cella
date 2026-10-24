import type { LoroDoc } from 'loro-crdt'
import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { tree } from './doc.ts'
import { fragment, type Fragment } from './ops.ts'

// The canonical form of a document: its blocks in order, each with its kind,
// the props that kind keeps, its text as runs with their marks, and its
// children. Block ids are left out: they are Loro's, and two documents that
// read the same hash the same however they were made. Empty runs and empty
// children are dropped so that absence has one spelling.
export type Canon = { v: 1; blocks: Block[] }
type Block = Omit<Fragment, 'runs' | 'children'> & { runs?: Fragment['runs']; children?: Block[] }

function block(f: Fragment): Block {
  const { runs, children, ...rest } = f
  const b: Block = { ...rest }
  if (runs.length) {
    b.runs = runs
  }
  if (children.length) {
    b.children = children.map(block)
  }
  return b
}

export function canonical(doc: LoroDoc): Canon {
  return { v: 1, blocks: tree(doc).roots().map((n) => block(fragment(doc, n.id))) }
}

// RFC 8785 (JCS): keys sorted by UTF-16 code units, which is what Array.sort
// compares; strings and numbers as ECMAScript's JSON.stringify writes them,
// which is what JCS prescribes; no whitespace.
export function jcs(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new Error('JCS has no spelling for a non-finite number')
    }
    if (v === undefined || typeof v === 'function' || typeof v === 'bigint') {
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

export function hash(doc: LoroDoc): string {
  return bytesToHex(blake3(bytes(doc)))
}
