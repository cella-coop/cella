import { blake3 } from '@noble/hashes/blake3.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { LoroText, type LoroDoc, type LoroTreeNode } from 'loro-crdt'

// The canonical form of a document: its block tree as plain JSON, in an
// editor-neutral shape, so the same document hashes the same whichever
// editor wrote it. nabu keeps lists as wrapper nodes (list > list-item >
// list); here an item is a block of its list's kind and its sublists'
// items are its children, so wrappers, and whether two adjacent lists were
// merged, leave no trace.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type Run = { text: string; marks?: Record<string, Json> }

export type Block = {
  type: string
  props?: Record<string, Json>
  text?: Run[]
  children?: Block[]
}

const kinds: Record<string, string> = { bullet: 'bullet', ordered: 'numbered', todo: 'todo' }
const renamed: Record<string, string> = { blockquote: 'quote' }

// Map keys that carry structure rather than props.
const structural = new Set(['type', 'text', 'listType'])

type Node = LoroTreeNode<Record<string, unknown>>

function runs(text: LoroText): Run[] {
  const out: Run[] = []
  for (const op of text.toDelta()) {
    if (typeof op.insert !== 'string' || !op.insert) {
      continue
    }
    const marks: Record<string, Json> = {}
    for (const [k, v] of Object.entries(op.attributes ?? {})) {
      if (v !== null && v !== undefined && v !== false) {
        marks[k] = v as Json
      }
    }
    const last = out.at(-1)
    if (last && jcs(last.marks ?? {}) === jcs(marks)) {
      last.text += op.insert
      continue
    }
    out.push(Object.keys(marks).length ? { text: op.insert, marks } : { text: op.insert })
  }
  return out
}

function props(node: Node, skip: Set<string>): Record<string, Json> | undefined {
  const out: Record<string, Json> = {}
  for (const [k, v] of Object.entries(node.data.toJSON() as Record<string, unknown>)) {
    if (structural.has(k) || skip.has(k) || v === null || v === undefined || typeof v === 'object') {
      continue
    }
    out[k] = v as Json
  }
  return Object.keys(out).length ? out : undefined
}

function block(node: Node, kind?: string): Block {
  const raw = String(node.data.get('type') ?? 'block')
  const type = raw === 'list-item' ? (kinds[kind ?? 'bullet'] ?? 'bullet') : (renamed[raw] ?? raw)
  const skip = new Set<string>()
  if (raw === 'list-item' && type !== 'todo') {
    skip.add('checked')
  }
  const out: Block = { type }
  const p = props(node, skip)
  if (type === 'todo') {
    out.props = { ...p, checked: !!node.data.get('checked') }
  } else if (p) {
    out.props = p
  }
  const text = node.data.get('text')
  if (text instanceof LoroText) {
    out.text = runs(text)
  }
  const children = blocks(node.children() ?? [])
  if (children.length) {
    out.children = children
  }
  return out
}

// A sequence of sibling nodes, with list wrappers spliced into their items.
function blocks(nodes: Node[]): Block[] {
  const out: Block[] = []
  for (const node of nodes) {
    if (node.data.get('type') === 'list') {
      const kind = String(node.data.get('listType') ?? 'bullet')
      for (const item of node.children() ?? []) {
        out.push(item.data.get('type') === 'list' ? blocks([item])[0] : block(item, kind))
      }
      continue
    }
    out.push(block(node))
  }
  return out
}

export function tree(doc: LoroDoc): Block[] {
  return blocks(doc.getTree('blocks').roots() as Node[])
}

// RFC 8785 (JCS): object keys sorted by UTF-16 code units, no whitespace,
// strings and numbers as ECMAScript's JSON.stringify writes them, which is
// what the RFC specifies.
export function jcs(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('JCS: non-finite number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(jcs).join(',')}]`
  }
  const keys = Object.keys(value)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`).join(',')}}`
}

export function canonical(doc: LoroDoc): string {
  return jcs({ blocks: tree(doc) })
}

export function hash(text: string): string {
  return bytesToHex(blake3(utf8ToBytes(text)))
}
