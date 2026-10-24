import { atomic, kinds, marks, propsOf, type Kind } from './blocks.ts'
import type { Fragment, Run } from './edits.ts'

// A document written as an outline, as fixtures write it: its blocks in
// reading order, each with a `depth` (0 at the top, one more than the
// block it nests under), its `type` and the props its type keeps, and its
// text as plain `text` or as `runs`, each a `text` with the marks on it
// (`bold = true`, `link = "https://…"`).
export type Line = { type?: string; depth?: number; text?: string; runs?: Record<string, unknown>[] } & Record<string, unknown>

const keys = new Set(['type', 'depth', 'text', 'runs'])

// The outline as a tree of fragments, or the first reason it is not one.
export function outline(lines: Line[], where = 'outline'): Fragment[] {
  const top: Fragment[] = []
  const path: Fragment[] = []
  lines.forEach((l, i) => {
    const at = `${where}, block ${i + 1}`
    const type = (l.type ?? 'paragraph') as Kind
    if (!kinds.includes(type)) {
      throw new Error(`${at}: no block type ${l.type}`)
    }
    for (const k of Object.keys(l)) {
      if (!keys.has(k) && !propsOf[type].includes(k)) {
        throw new Error(`${at}: a ${type} keeps no ${k}`)
      }
    }
    const depth = l.depth ?? 0
    if (!Number.isInteger(depth) || depth < 0 || depth > path.length) {
      throw new Error(`${at}: depth ${depth} does not nest under the block before`)
    }
    if (l.text !== undefined && l.runs !== undefined) {
      throw new Error(`${at}: text or runs, not both`)
    }
    const rs: Run[] = l.runs ? l.runs.map((r) => run(r, at)) : l.text ? [{ text: l.text }] : []
    if (atomic.has(type) && rs.length) {
      throw new Error(`${at}: a ${type} holds no text`)
    }
    if (type === 'heading' && ![1, 2, 3].includes(l.level as number)) {
      throw new Error(`${at}: a heading's level is 1, 2 or 3`)
    }
    if (type === 'todo' && typeof l.checked !== 'boolean') {
      throw new Error(`${at}: a to-do is checked or not`)
    }
    if (type === 'embed' && (typeof l.embed !== 'string' || typeof l.ref !== 'string')) {
      throw new Error(`${at}: an embed names its kind and ref`)
    }
    const f: Fragment = { type, runs: rs, children: [] }
    for (const k of propsOf[type]) {
      if (l[k] !== undefined) {
        ;(f as Record<string, unknown>)[k] = l[k]
      }
    }
    path.length = depth
    ;(depth ? path[depth - 1].children : top).push(f)
    path.push(f)
  })
  return top
}

function run(r: Record<string, unknown>, at: string): Run {
  if (typeof r.text !== 'string' || !r.text) {
    throw new Error(`${at}: a run holds text`)
  }
  const out: Run = { text: r.text }
  for (const k of Object.keys(r)) {
    if (k === 'text') {
      continue
    }
    if (!(marks as readonly string[]).includes(k)) {
      throw new Error(`${at}: no mark ${k}`)
    }
    const v = r[k]
    if (k === 'link' ? typeof v !== 'string' : v !== true) {
      throw new Error(`${at}: ${k} is ${k === 'link' ? 'an address' : 'true'}`)
    }
    out.marks = { ...out.marks, [k]: v as true | string }
  }
  return out
}

// The embeds an outline holds, for checking what they name.
export function embedded(fs: Fragment[]): { embed: string; ref: string }[] {
  return fs.flatMap((f) => [...(f.type === 'embed' ? [{ embed: String(f.embed), ref: String(f.ref) }] : []), ...embedded(f.children)])
}
