import type { Delta, LoroDoc, LoroText } from 'loro-crdt'
import {
  atomic,
  childrenOf,
  exists,
  indexOf,
  init,
  kind,
  marks,
  node,
  parentOf,
  props,
  propsOf,
  text,
  tree,
  type Kind,
  type Mark,
  type Marks,
  type Node,
  type Props,
  type TreeID,
} from './blocks.ts'

// The edits a block document knows. None commits: the caller groups edits
// into one commit, which is one undo step and one update to send.

export type Run = { text: string; marks?: Marks }

// Loro refuses a UTF-16 offset inside a surrogate pair; the DOM hands them
// out freely. Snap one back to the code point's start.
export function snap(s: string, at: number): number {
  const c = s.charCodeAt(at)
  return at > 0 && at < s.length && c >= 0xdc00 && c <= 0xdfff ? at - 1 : at
}

// A text's runs: its delta with falsy marks dropped and equal neighbours
// joined, so two texts that read the same give the same runs.
export function runs(t: LoroText, start = 0, end = t.length): Run[] {
  const out: Run[] = []
  for (const d of t.sliceDelta(start, end)) {
    if (typeof d.insert !== 'string') {
      continue
    }
    const m: Marks = {}
    for (const key of marks) {
      const v = d.attributes?.[key]
      if (v !== undefined && v !== null && v !== false) {
        m[key] = v as true | string
      }
    }
    const last = out.at(-1)
    if (last && same(last.marks ?? {}, m)) {
      last.text += d.insert
    } else {
      out.push(Object.keys(m).length ? { text: d.insert, marks: m } : { text: d.insert })
    }
  }
  return out
}

function same(a: Marks, b: Marks): boolean {
  return marks.every((k) => a[k] === b[k])
}

// The marks at a caret: those of the character before it, as Loro expands
// them when one types there; a link does not expand.
export function marksAt(t: LoroText, at: number): Marks {
  if (at === 0) {
    return {}
  }
  const r = runs(t, at - 1, at)[0]
  const m = { ...(r?.marks ?? {}) }
  delete m.link
  return m
}

// Insert text carrying exactly `m` when given, or Loro's expansion if not.
export function insert(t: LoroText, at: number, s: string, m?: Marks): void {
  if (!s) {
    return
  }
  t.insert(at, s)
  if (m) {
    restyle(t, at, at + s.length, m)
  }
}

function restyle(t: LoroText, start: number, end: number, m: Marks): void {
  const have = runs(t, start, end)
  for (const key of marks) {
    const want = m[key]
    if (want === undefined) {
      if (have.some((r) => r.marks?.[key] !== undefined)) {
        t.unmark({ start, end }, key)
      }
    } else if (!have.every((r) => r.marks?.[key] === want)) {
      t.mark({ start, end }, key, want)
    }
  }
}

export function insertRuns(t: LoroText, at: number, rs: Run[]): number {
  let pos = at
  for (const r of rs) {
    insert(t, pos, r.text, r.marks ?? {})
    pos += r.text.length
  }
  return pos - at
}

export function remove(t: LoroText, at: number, len: number): void {
  if (len > 0) {
    t.delete(at, len)
  }
}

// Toggle a mark over a range: off when the whole range has it, on if not.
export function toggle(t: LoroText, start: number, end: number, key: Mark, value: true | string = true): boolean {
  if (start === end) {
    return false
  }
  const on = runs(t, start, end).every((r) => r.marks?.[key] !== undefined)
  if (on) {
    t.unmark({ start, end }, key)
  } else {
    t.mark({ start, end }, key, value)
  }
  return !on
}

// The kind a block's continuation takes when it is split at its end.
function next(k: Kind): Kind {
  return k === 'heading' || k === 'quote' || atomic.has(k) ? 'paragraph' : k
}

// Create a block at a position under a parent (the top level if none).
export function create(doc: LoroDoc, parent: TreeID | undefined, index: number, k: Kind, p: Props = {}, rs: Run[] = []): TreeID {
  const n = parent === undefined ? tree(doc).createNode(undefined, index) : node(doc, parent).createNode(index)
  const t = init(n, k, p)
  insertRuns(t, 0, rs)
  return n.id
}

export function after(doc: LoroDoc, id: TreeID, k: Kind, p: Props = {}, rs: Run[] = []): TreeID {
  return create(doc, parentOf(doc, id), indexOf(doc, id) + 1, k, p, rs)
}

// Split a block at a caret; returns the block that holds the caret after.
// At the start of a non-empty block an empty sibling goes before it and the
// block keeps its identity. Otherwise the tail moves to a new block: its
// first child when it has children, as an outline does, or else its next
// sibling.
export function split(doc: LoroDoc, id: TreeID, at: number): TreeID {
  const t = text(doc, id)
  const k = kind(doc, id)
  if (at === 0 && t.length > 0) {
    const p = props(doc, id)
    delete p.checked
    create(doc, parentOf(doc, id), indexOf(doc, id), k, p)
    return id
  }
  const tail = runs(t, at)
  remove(t, at, t.length - at)
  const nk = at === 0 ? k : next(k)
  const p: Props = nk === 'code' ? { language: node(doc, id).data.get('language') as string } : {}
  if (childrenOf(doc, id).length) {
    return create(doc, id, 0, nk, p, tail)
  }
  return after(doc, id, nk, p, tail)
}

// Merge a block into the one before it: its text is appended, and it goes.
// Its children take its place when it was the target's own child, and
// follow the target's children otherwise, so reading order holds. Returns
// the caret offset in the target.
export function merge(doc: LoroDoc, into: TreeID, id: TreeID): number {
  const t = text(doc, into)
  const at = t.length
  insertRuns(t, at, runs(text(doc, id)))
  const target = node(doc, into)
  const own = parentOf(doc, id) === into
  let i = own ? indexOf(doc, id) : (target.children()?.length ?? 0)
  for (const c of childrenOf(doc, id)) {
    c.move(target, i++)
  }
  tree(doc).delete(id)
  return at
}

// Nest a block under its previous sibling, as that sibling's last child.
export function indent(doc: LoroDoc, id: TreeID): boolean {
  const i = indexOf(doc, id)
  if (i === 0) {
    return false
  }
  const prev = childrenOf(doc, parentOf(doc, id))[i - 1]
  node(doc, id).move(prev, prev.children()?.length ?? 0)
  return true
}

// Lift a block out of its parent to just after it; the siblings that came
// after it become its children, so reading order holds.
export function outdent(doc: LoroDoc, id: TreeID): boolean {
  const parent = parentOf(doc, id)
  if (parent === undefined) {
    return false
  }
  const n = node(doc, id)
  const later = childrenOf(doc, parent).slice(indexOf(doc, id) + 1)
  for (const s of later) {
    s.move(n, n.children()?.length ?? 0)
  }
  n.moveAfter(node(doc, parent))
  return true
}

export type Place = { before: TreeID } | { after: TreeID } | { into: TreeID }

// Move a block to a place: before or after another block, or first under it.
// Moving a block into its own subtree is refused.
export function move(doc: LoroDoc, id: TreeID, place: Place): boolean {
  const target = 'before' in place ? place.before : 'after' in place ? place.after : place.into
  if (target === id || !exists(doc, target)) {
    return false
  }
  for (let p: TreeID | undefined = target; p !== undefined; p = parentOf(doc, p)) {
    if (p === id) {
      return false
    }
  }
  const n = node(doc, id)
  const t = node(doc, target)
  if ('before' in place) {
    n.moveBefore(t)
  } else if ('after' in place) {
    n.moveAfter(t)
  } else {
    n.move(t, 0)
  }
  return true
}

export function retype(doc: LoroDoc, id: TreeID, k: Kind, p: Props = {}): void {
  const data = node(doc, id).data
  const old = kind(doc, id)
  if (old !== k) {
    data.set('type', k)
  }
  for (const key of propsOf[old]) {
    if (!propsOf[k].includes(key)) {
      data.delete(key)
    }
  }
  for (const key of propsOf[k]) {
    const v = (p as Record<string, unknown>)[key]
    if (v !== undefined && data.get(key) !== v) {
      data.set(key, v as never)
    }
  }
}

export function check(doc: LoroDoc, id: TreeID, checked: boolean): void {
  node(doc, id).data.set('checked', checked)
}

export function drop(doc: LoroDoc, id: TreeID): void {
  if (exists(doc, id)) {
    tree(doc).delete(id)
  }
}

// A fragment of blocks, as copied: the canonical shape, minus ids.
export type Fragment = { type: Kind; runs: Run[]; children: Fragment[] } & Props

export function fragment(doc: LoroDoc, id: TreeID): Fragment {
  const k = kind(doc, id)
  const data = node(doc, id).data
  const f: Fragment = { type: k, runs: atomic.has(k) ? [] : runs(text(doc, id)), children: [] }
  for (const key of propsOf[k]) {
    const v = data.get(key)
    if (v !== undefined) {
      ;(f as Record<string, unknown>)[key] = v
    }
  }
  f.children = childrenOf(doc, id).map((c: Node) => fragment(doc, c.id))
  return f
}

// Paste fragments at a place under a parent; returns the top-level ids.
export function paste(doc: LoroDoc, parent: TreeID | undefined, index: number, fs: Fragment[]): TreeID[] {
  return fs.map((f, i) => {
    const { type, runs: rs, children, ...p } = f
    const id = create(doc, parent, index + i, type, p, rs)
    paste(doc, id, 0, children)
    return id
  })
}

// An offset carried through a text delta: text inserted before it pushes
// it on, text deleted before it pulls it back; an insert at the offset
// itself goes after the caret, so a remote typist never drags it along.
export function shift(offset: number, delta: Delta<string>[]): number {
  let pos = 0
  let out = offset
  for (const d of delta) {
    if (d.retain !== undefined) {
      pos += d.retain
    } else if (d.insert !== undefined) {
      const n = typeof d.insert === 'string' ? d.insert.length : 1
      if (pos < out) {
        out += n
      }
      pos += n
    } else if (d.delete !== undefined) {
      if (pos < out) {
        out -= Math.min(d.delete, out - pos)
      }
    }
  }
  return out
}

// Make a list of sibling blocks read as fragments, keeping the blocks
// that already do: blocks reading the same are matched in order (their
// longest common subsequence), a changed block between two matches keeps
// its identity when one of its type is free there, and the rest are
// created or dropped. The seed carries one version into the next this
// way, so a comment's cursor in a block that did not change still finds
// it.
export function patch(doc: LoroDoc, parent: TreeID | undefined, fs: Fragment[]): void {
  const olds = childrenOf(doc, parent).map((n) => n.id)
  const key = (f: Fragment) => JSON.stringify([f.type, f.runs, ...propsOf[f.type].map((k) => (f as Record<string, unknown>)[k])])
  const a = olds.map((id) => key(fragment(doc, id)))
  const b = fs.map(key)
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const matches: [number, number][] = []
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      matches.push([i++, j++])
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  matches.push([a.length, b.length])
  const kept: (TreeID | null)[] = fs.map(() => null)
  const gone: TreeID[] = []
  let pi = 0
  let pj = 0
  for (const [mi, mj] of matches) {
    const free = olds.slice(pi, mi)
    for (let j = pj; j < mj; j++) {
      const s = free.findIndex((id) => kind(doc, id) === fs[j].type)
      if (s >= 0) {
        kept[j] = free.splice(s, 1)[0]
      }
    }
    gone.push(...free)
    if (mj < b.length) {
      kept[mj] = olds[mi]
    }
    pi = mi + 1
    pj = mj + 1
  }
  for (const id of gone) {
    drop(doc, id)
  }
  fs.forEach((f, at) => {
    const { type, runs: rs, children, ...p } = f
    let id = kept[at]
    if (id === null) {
      id = create(doc, parent, at, type, p)
    } else {
      retype(doc, id, type, p)
      for (const k of propsOf[type]) {
        if ((p as Record<string, unknown>)[k] === undefined && node(doc, id).data.get(k) !== undefined) {
          node(doc, id).data.delete(k)
        }
      }
      if (indexOf(doc, id) !== at) {
        node(doc, id).move(parent === undefined ? undefined : node(doc, parent), at)
      }
    }
    const t = text(doc, id)
    const want = rs.map((r) => r.text).join('')
    if (t.toString() !== want) {
      t.update(want)
    }
    let pos = 0
    for (const r of rs) {
      restyle(t, pos, pos + r.text.length, r.marks ?? {})
      pos += r.text.length
    }
    patch(doc, id, children)
  })
}
