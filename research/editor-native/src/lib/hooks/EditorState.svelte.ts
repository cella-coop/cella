import { flushSync } from 'svelte'
import { UndoManager, type Cursor, type Delta, type LoroDoc, type LoroEventBatch } from 'loro-crdt'
import { atomic, exists, indexOf, kind, order, parentOf, props, subtree, text, type Kind, type Marks, type Props, type TreeID } from '../model/doc.ts'
import * as ops from '../model/ops.ts'
import { caretRect, length, offsetAt, onFirstLine, onLastLine, paint, readSel, writeSel, type Sel } from '../editor/dom.ts'

// One row of the editor: a block as it is drawn. A row object is replaced
// only when its drawing changes, so Svelte redraws only those rows; text is
// painted into the row's editable directly, not by Svelte.
export type View = { id: TreeID; parent: TreeID | undefined; depth: number; kind: Kind; props: Props; number: number }

export type Item = { label: string; hint: string; kind: Kind; props?: Props }

export const items: Item[] = [
  { label: 'Text', hint: 'paragraph', kind: 'paragraph' },
  { label: 'Heading 1', hint: '#', kind: 'heading', props: { level: 1 } },
  { label: 'Heading 2', hint: '##', kind: 'heading', props: { level: 2 } },
  { label: 'Heading 3', hint: '###', kind: 'heading', props: { level: 3 } },
  { label: 'Bulleted list', hint: '-', kind: 'bullet' },
  { label: 'Numbered list', hint: '1.', kind: 'numbered' },
  { label: 'To-do', hint: '[]', kind: 'todo', props: { checked: false } },
  { label: 'Quote', hint: '>', kind: 'quote' },
  { label: 'Code', hint: '```', kind: 'code', props: { language: 'text' } },
  { label: 'Divider', hint: '---', kind: 'divider' },
  { label: 'Decision', hint: 'embed', kind: 'decision', props: { decision: 'd-2026-011' } },
]

// Markdown shortcuts, typed at a block's start and closed by a space.
const shortcuts: [RegExp, Kind, Props][] = [
  [/^#$/, 'heading', { level: 1 }],
  [/^##$/, 'heading', { level: 2 }],
  [/^###$/, 'heading', { level: 3 }],
  [/^[-*]$/, 'bullet', {}],
  [/^1\.$/, 'numbered', {}],
  [/^\[ ?\]$/, 'todo', { checked: false }],
  [/^>$/, 'quote', {}],
  [/^```\w*$/, 'code', { language: 'text' }],
]

type Want = { id: TreeID; anchor: number; focus: number }
type Caret = { id: TreeID; anchor: Cursor; focus: Cursor }
type Slash = { id: TreeID; at: number; index: number; x: number; y: number }
export type Drop = { id: TreeID; place: 'before' | 'after' | 'into' }

const blocksType = 'application/x-cella-blocks'
const runsType = 'application/x-cella-runs'

export class EditorState {
  readonly doc: LoroDoc
  readonly undo: UndoManager

  rows: View[] = $state.raw([])
  // Block selection: an anchor and a focus row, covering their subtrees.
  range: { anchor: TreeID; focus: TreeID } | null = $state.raw(null)
  slash: Slash | null = $state.raw(null)
  query = $state('')
  bar: { x: number; y: number } | null = $state.raw(null)
  dropAt: Drop | null = $state.raw(null)

  root: HTMLElement | null = null
  readonly #els = new Map<TreeID, HTMLElement>()
  #views = new Map<TreeID, View>()
  #dirty = new Set<TreeID>()
  #structure = true
  #scheduled = false
  #want: Want | null = null
  #caret: Caret | null = null
  #remote: Want | null = null
  readonly #unsubscribe: () => void
  #composing: { id: TreeID; at: number; cursor: Cursor | undefined; done: boolean } | null = null
  // Marks toggled with no range, for the next typed text at this caret.
  #pending: { marks: Marks; id: TreeID; at: number } | null = null
  #dragging: TreeID[] = []
  #press: TreeID | null = null

  constructor(doc: LoroDoc) {
    this.doc = doc
    // The undo stack holds this peer's commits only; a remote edit is never
    // undone here. Each step keeps the caret it was made at.
    this.undo = new UndoManager(doc, {
      mergeInterval: 500,
      excludeOriginPrefixes: ['seed'],
      onPush: () => {
        const c = this.#caret
        return { value: c?.id ?? null, cursors: c ? [c.anchor, c.focus] : [] }
      },
      onPop: (_undo, { value, cursors }) => {
        if (typeof value === 'string' && cursors.length === 2) {
          const a = this.doc.getCursorPos(cursors[0])?.offset
          const f = this.doc.getCursorPos(cursors[1])?.offset
          if (a !== undefined && f !== undefined) {
            this.#want = { id: value as TreeID, anchor: a, focus: f }
          }
        }
      },
    })
    this.#unsubscribe = doc.subscribe((batch) => this.#events(batch))
    this.#rebuild()
  }

  destroy(): void {
    this.#unsubscribe()
    this.undo.free()
  }

  // Changes, local or remote, mark the blocks they touch; a flush redraws
  // them. Local edits flush at once; imports in a microtask.
  #events(batch: LoroEventBatch): void {
    for (const e of batch.events) {
      if (batch.by !== 'local' && e.diff.type === 'text') {
        this.#shiftCaret(e.path[1] as TreeID, e.diff.diff)
      }
      if (e.diff.type === 'tree') {
        this.#structure = true
        for (const d of e.diff.diff) {
          this.#dirty.add(d.target)
        }
        continue
      }
      const id = e.path[1] as TreeID | undefined
      if (id !== undefined) {
        this.#dirty.add(id)
        if (e.diff.type === 'map') {
          this.#structure = true
        }
      }
    }
    if (!this.#scheduled) {
      this.#scheduled = true
      queueMicrotask(() => this.flush())
    }
  }

  #rebuild(): void {
    const next = new Map<TreeID, View>()
    const count = new Map<string, number>()
    const last = new Map<string, Kind>()
    const rows: View[] = []
    for (const r of order(this.doc)) {
      const k = kind(this.doc, r.id)
      const scope = r.parent ?? ''
      const n = k === 'numbered' ? (last.get(scope) === 'numbered' ? (count.get(scope) ?? 0) + 1 : 1) : 0
      count.set(scope, n)
      last.set(scope, k)
      const p = props(this.doc, r.id)
      const old = this.#views.get(r.id)
      const v =
        old && old.depth === r.depth && old.parent === r.parent && old.kind === k && old.number === n && JSON.stringify(old.props) === JSON.stringify(p)
          ? old
          : { id: r.id, parent: r.parent, depth: r.depth, kind: k, props: p, number: n }
      next.set(r.id, v)
      rows.push(v)
    }
    this.#views = next
    this.rows = rows
  }

  flush(): void {
    this.#scheduled = false
    if (this.#structure) {
      this.#structure = false
      this.#rebuild()
      if (this.range && !(exists(this.doc, this.range.anchor) && exists(this.doc, this.range.focus))) {
        this.range = null
      }
      if (this.slash && !exists(this.doc, this.slash.id)) {
        this.slash = null
      }
      flushSync()
    }
    const focused = this.#focusedId()
    let kept: Want | null = null
    for (const id of this.#dirty) {
      if (this.#composing?.id === id) {
        continue
      }
      const el = this.#els.get(id)
      if (el && exists(this.doc, id)) {
        // Repainting drops the DOM selection inside; keep it where it was.
        const s = id === focused ? readSel(el) : null
        paint(el, ops.runs(text(this.doc, id)))
        if (s) {
          kept = { id, anchor: s.anchor, focus: s.focus }
        }
      }
      this.#dirty.delete(id)
    }
    if (this.#want) {
      this.#place(this.#want)
    } else if (this.#remote && !this.#composing) {
      // A remote edit redrew the block under the caret: put it back where
      // the edit moved it, so it never jumps.
      const el = this.#els.get(this.#remote.id)
      if (el && (focused === this.#remote.id || document.activeElement === document.body)) {
        writeSel(el, this.#remote.anchor, this.#remote.focus)
      }
    } else if (kept) {
      const el = this.#els.get(kept.id)!
      writeSel(el, kept.anchor, kept.focus)
    }
    this.#remote = null
  }

  // Carry the caret through a remote text edit, from the DOM's selection,
  // which still shows the text before it until the flush repaints. Cursors
  // taken on selectionchange would do the same, but that event lags the
  // keys that move the caret, and a remote edit can land in between.
  #shiftCaret(id: TreeID, delta: Delta<string>[]): void {
    if (this.#composing?.id === id) {
      return
    }
    if (this.#remote?.id !== id) {
      const el = this.#els.get(id)
      const s = el && document.activeElement === el ? readSel(el) : null
      if (!s) {
        return
      }
      this.#remote = { id, anchor: s.anchor, focus: s.focus }
    }
    const r = this.#remote
    r.anchor = ops.shift(r.anchor, delta)
    r.focus = ops.shift(r.focus, delta)
  }

  #place(w: Want): void {
    const el = this.#els.get(w.id)
    if (!el) {
      return
    }
    this.#want = null
    this.range = null
    writeSel(el, w.anchor, w.focus)
    this.track()
  }

  // Run an edit as one commit, then draw it and put the caret where it says.
  apply(edit: () => Want | void): void {
    const want = edit()
    if (want) {
      this.#want = want
    }
    this.doc.commit()
    this.flush()
  }

  mount(id: TreeID, el: HTMLElement): () => void {
    this.#els.set(id, el)
    paint(el, ops.runs(text(this.doc, id)))
    this.#dirty.delete(id)
    if (this.#want?.id === id) {
      this.#place(this.#want)
    }
    return () => {
      if (this.#els.get(id) === el) {
        this.#els.delete(id)
      }
    }
  }

  #focusedId(): TreeID | null {
    const a = document.activeElement as HTMLElement | null
    const id = a?.dataset.block as TreeID | undefined
    return id && this.#els.get(id) === a ? id : null
  }

  #sel(): (Sel & { id: TreeID; el: HTMLElement }) | null {
    const id = this.#focusedId()
    if (!id) {
      return null
    }
    const el = this.#els.get(id)!
    const s = readSel(el)
    return s ? { ...s, id, el } : null
  }

  // Keep the caret as Loro cursors, which survive remote edits, and keep the
  // toolbar and slash menu in step with it.
  track(): void {
    if (this.#composing) {
      return
    }
    const s = this.#sel()
    if (!s) {
      this.bar = null
      return
    }
    const t = text(this.doc, s.id)
    const anchor = t.getCursor(s.anchor)
    const focus = t.getCursor(s.focus)
    if (anchor && focus) {
      this.#caret = { id: s.id, anchor, focus }
    }
    if (s.collapsed) {
      this.bar = null
    } else {
      const r = caretRect(s.el)
      this.bar = { x: r.left, y: r.top }
    }
    const sl = this.slash
    if (sl) {
      const q = t.toString().slice(sl.at + 1, s.focus)
      if (sl.id !== s.id || s.focus <= sl.at || q.includes('\n') || q.length > 20) {
        this.slash = null
      } else if (q !== this.query) {
        this.query = q
        this.slash = { ...sl, index: 0 }
      }
    }
  }

  selectionChanged(): void {
    const p = this.#pending
    if (p) {
      const s = this.#sel()
      if (!s || s.id !== p.id || !s.collapsed || s.start !== p.at) {
        this.#pending = null
      }
    }
    this.track()
  }

  #marks(id: TreeID): Marks | undefined {
    return this.#pending?.id === id ? this.#pending.marks : undefined
  }

  #keep(id: TreeID, at: number): void {
    if (this.#pending?.id === id) {
      this.#pending = { ...this.#pending, at }
    }
  }

  matches: Item[] = $derived.by(() => {
    const q = this.query.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.hint.includes(q))
  })

  // Text input.

  #insert(s: Sel & { id: TreeID }, data: string): void {
    const t = text(this.doc, s.id)
    this.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      ops.insert(t, s.start, data, this.#marks(s.id))
      this.#keep(s.id, s.start + data.length)
      return { id: s.id, anchor: s.start + data.length, focus: s.start + data.length }
    })
    this.#afterType(s.id, s.start, data)
  }

  #afterType(id: TreeID, at: number, data: string): void {
    const t = text(this.doc, id)
    const k = kind(this.doc, id)
    const before = t.toString().slice(0, at + data.length)
    if (data === '/' && (at === 0 || /\s/.test(before.at(-2) ?? ''))) {
      const el = this.#els.get(id)
      const r = el ? caretRect(el) : { left: 0, bottom: 0 }
      this.query = ''
      this.slash = { id, at, index: 0, x: r.left, y: r.bottom }
      return
    }
    if (k === 'code') {
      return
    }
    if (before === '---') {
      this.apply(() => {
        ops.remove(t, 0, 3)
        ops.retype(this.doc, id, 'divider')
        const n = ops.after(this.doc, id, 'paragraph', {}, ops.runs(t))
        ops.remove(t, 0, t.length)
        return { id: n, anchor: 0, focus: 0 }
      })
      return
    }
    if (data === ' ' && k !== 'heading') {
      const head = before.slice(0, -1)
      for (const [re, nk, p] of shortcuts) {
        if (re.test(head) && k !== nk) {
          this.apply(() => {
            ops.remove(t, 0, head.length + 1)
            ops.retype(this.doc, id, nk, p)
            return { id, anchor: 0, focus: 0 }
          })
          return
        }
      }
    }
    if (data === ' ' && k === 'heading') {
      const head = before.slice(0, -1)
      const m = /^(#{1,3})$/.exec(head)
      if (m) {
        this.apply(() => {
          ops.remove(t, 0, head.length + 1)
          ops.retype(this.doc, id, 'heading', { level: m[1].length })
          return { id, anchor: 0, focus: 0 }
        })
      }
    }
  }

  // The browser asks before it edits; every edit is refused and made in
  // Loro instead, except composition, which the IME owns until it ends.
  beforeinput(e: InputEvent): void {
    const type = e.inputType
    if (type === 'insertCompositionText') {
      return
    }
    e.preventDefault()
    const s = this.#sel()
    if (!s) {
      return
    }
    const t = text(this.doc, s.id)
    switch (type) {
      case 'insertText':
      case 'insertReplacementText': {
        const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? ''
        const range = this.#target(e, s)
        this.#insert({ ...s, ...range }, data)
        return
      }
      case 'insertFromComposition': {
        // Safari ends a composition with a cancelable insert.
        if (this.#composing) {
          this.#commitComposition(e.data ?? '')
        }
        return
      }
      case 'insertParagraph':
        this.enter(s)
        return
      case 'insertLineBreak':
        this.#insert(s, '\n')
        return
      case 'deleteContentBackward':
      case 'deleteContentForward':
      case 'deleteWordBackward':
      case 'deleteWordForward':
      case 'deleteSoftLineBackward':
      case 'deleteHardLineBackward':
      case 'deleteSoftLineForward':
      case 'deleteHardLineForward':
      case 'deleteByCut':
      case 'deleteContent': {
        const back = !type.endsWith('Forward')
        if (s.collapsed && back && s.start === 0) {
          this.backspaceAtStart(s.id)
          return
        }
        if (s.collapsed && !back && s.end === t.length) {
          this.deleteAtEnd(s.id)
          return
        }
        const r = this.#target(e, s)
        this.apply(() => {
          ops.remove(t, r.start, r.end - r.start)
          return { id: s.id, anchor: r.start, focus: r.start }
        })
        return
      }
      case 'formatBold':
        this.mark('bold')
        return
      case 'formatItalic':
        this.mark('italic')
        return
      case 'historyUndo':
        this.doUndo()
        return
      case 'historyRedo':
        this.doRedo()
        return
    }
  }

  // The range the browser means to edit: its target range when it gives
  // one (a grapheme, a word, a spelling fix), the selection if not.
  #target(e: InputEvent, s: Sel & { id: TreeID; el: HTMLElement }): { start: number; end: number } {
    const r = e.getTargetRanges?.()[0]
    if (!r) {
      return { start: s.start, end: s.end }
    }
    const range = document.createRange()
    range.setStart(r.startContainer, r.startOffset)
    range.setEnd(r.endContainer, r.endOffset)
    const pre = document.createRange()
    pre.setStart(s.el, 0)
    pre.setEnd(r.startContainer, r.startOffset)
    const start = s.el.contains(r.startContainer) ? pre.toString().length : 0
    const end = s.el.contains(r.endContainer) ? start + range.toString().length : length(s.el)
    const str = text(this.doc, s.id).toString()
    return { start: ops.snap(str, start), end: ops.snap(str, end) }
  }

  compositionstart(): void {
    const s = this.#sel()
    if (!s) {
      return
    }
    if (!s.collapsed) {
      // Clear the selection before the IME draws over it.
      this.apply(() => {
        ops.remove(text(this.doc, s.id), s.start, s.end - s.start)
        return { id: s.id, anchor: s.start, focus: s.start }
      })
    }
    this.#composing = { id: s.id, at: s.start, cursor: text(this.doc, s.id).getCursor(s.start), done: false }
  }

  compositionend(e: CompositionEvent): void {
    const c = this.#composing
    if (!c) {
      return
    }
    if (!c.done) {
      this.#commitComposition(e.data ?? '')
    }
    this.#composing = null
    this.flush()
  }

  // The IME drew its text into the DOM; redraw the block from Loro and
  // insert the composed text there, as one edit.
  #commitComposition(data: string): void {
    const c = this.#composing!
    c.done = true
    const id = c.id
    this.#composing = null
    if (!exists(this.doc, id)) {
      return
    }
    const t = text(this.doc, id)
    // Where the composition began, after any remote edit made meanwhile.
    const at = Math.min((c.cursor && this.doc.getCursorPos(c.cursor)?.offset) ?? c.at, t.length)
    this.#dirty.add(id)
    if (data) {
      this.apply(() => {
        ops.insert(t, at, data, this.#marks(id))
        this.#keep(id, at + data.length)
        return { id, anchor: at + data.length, focus: at + data.length }
      })
      this.#afterType(id, at, data)
    } else {
      this.flush()
    }
    this.#composing = { ...c, at }
  }

  get composing(): boolean {
    return this.#composing !== null
  }

  // Blocks.

  enter(s: Sel & { id: TreeID }): void {
    const k = kind(this.doc, s.id)
    const t = text(this.doc, s.id)
    if (k === 'code') {
      this.#insert(s, '\n')
      return
    }
    // Enter on an empty list item ends the list, as an outline does.
    if (t.length === 0 && (k === 'bullet' || k === 'numbered' || k === 'todo' || k === 'quote')) {
      this.apply(() => {
        if (!ops.outdent(this.doc, s.id)) {
          ops.retype(this.doc, s.id, 'paragraph')
        }
        return { id: s.id, anchor: 0, focus: 0 }
      })
      return
    }
    this.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      const id = ops.split(this.doc, s.id, s.start)
      return { id, anchor: 0, focus: 0 }
    })
  }

  #index(id: TreeID): number {
    return this.rows.findIndex((r) => r.id === id)
  }

  backspaceAtStart(id: TreeID): void {
    const k = kind(this.doc, id)
    if (k !== 'paragraph') {
      this.apply(() => {
        ops.retype(this.doc, id, 'paragraph')
        return { id, anchor: 0, focus: 0 }
      })
      return
    }
    const prev = this.rows[this.#index(id) - 1]
    if (!prev) {
      return
    }
    if (atomic.has(prev.kind)) {
      if (text(this.doc, id).length === 0) {
        this.apply(() => {
          ops.drop(this.doc, id)
        })
      }
      this.select(prev.id)
      return
    }
    this.apply(() => {
      const at = ops.merge(this.doc, prev.id, id)
      return { id: prev.id, anchor: at, focus: at }
    })
  }

  deleteAtEnd(id: TreeID): void {
    const next = this.rows[this.#index(id) + 1]
    if (!next) {
      return
    }
    if (atomic.has(next.kind)) {
      this.select(next.id)
      return
    }
    this.apply(() => {
      const at = ops.merge(this.doc, id, next.id)
      return { id, anchor: at, focus: at }
    })
  }

  // Tab and Shift-Tab: on the caret's block, or on the selection's roots.
  nest(out: boolean): void {
    const ids = this.range ? this.roots() : [this.#focusedId()].filter((x): x is TreeID => !!x)
    const s = this.#sel()
    this.apply(() => {
      for (const id of out ? [...ids].reverse() : ids) {
        if (out) {
          ops.outdent(this.doc, id)
        } else {
          ops.indent(this.doc, id)
        }
      }
      return s ? { id: s.id, anchor: s.anchor, focus: s.focus } : undefined
    })
  }

  mark(key: 'bold' | 'italic' | 'code' | 'link', href?: string): void {
    const s = this.#sel()
    if (!s) {
      return
    }
    const t = text(this.doc, s.id)
    if (s.collapsed) {
      // No range: the next typed text takes the toggled mark.
      if (key === 'link') {
        return
      }
      const m = { ...(this.#marks(s.id) ?? ops.marksAt(t, s.start)) }
      if (m[key]) {
        delete m[key]
      } else {
        m[key] = true
      }
      this.#pending = { marks: m, id: s.id, at: s.start }
      return
    }
    if (key === 'link' && href === undefined) {
      return
    }
    this.apply(() => {
      ops.toggle(t, s.start, s.end, key, key === 'link' ? href! : true)
      return { id: s.id, anchor: s.anchor, focus: s.focus }
    })
  }

  setKind(id: TreeID, k: Kind, p: Props = {}): void {
    this.apply(() => {
      ops.retype(this.doc, id, k, p)
    })
  }

  check(id: TreeID, checked: boolean): void {
    this.apply(() => {
      ops.check(this.doc, id, checked)
    })
  }

  // Slash menu.

  choose(item: Item): void {
    const sl = this.slash
    if (!sl) {
      return
    }
    this.slash = null
    const t = text(this.doc, sl.id)
    const end = sl.at + 1 + this.query.length
    this.apply(() => {
      ops.remove(t, sl.at, Math.min(end, t.length) - sl.at)
      if (atomic.has(item.kind)) {
        const empty = t.length === 0
        const target = empty ? sl.id : ops.after(this.doc, sl.id, item.kind, item.props)
        if (empty) {
          ops.retype(this.doc, sl.id, item.kind, item.props)
        }
        const n = ops.after(this.doc, target, 'paragraph')
        return { id: n, anchor: 0, focus: 0 }
      }
      ops.retype(this.doc, sl.id, item.kind, item.props)
      return { id: sl.id, anchor: sl.at, focus: sl.at }
    })
  }

  slashKey(e: KeyboardEvent): boolean {
    const sl = this.slash
    if (!sl) {
      return false
    }
    const n = this.matches.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (n) {
        this.slash = { ...sl, index: (sl.index + (e.key === 'ArrowDown' ? 1 : n - 1)) % n }
      }
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const item = this.matches[sl.index]
      if (item) {
        this.choose(item)
      } else {
        this.slash = null
      }
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      this.slash = null
      return true
    }
    return false
  }

  // Block selection.

  select(anchor: TreeID, focus: TreeID = anchor): void {
    this.range = { anchor, focus }
    this.slash = null
    this.bar = null
    document.getSelection()?.removeAllRanges()
    this.root?.focus({ preventScroll: true })
  }

  // The selected rows: from anchor to focus in reading order, grown to
  // cover the subtrees of the rows in it.
  selected: Set<TreeID> = $derived.by(() => {
    const r = this.range
    const rows = this.rows
    const a = r ? rows.findIndex((x) => x.id === r.anchor) : -1
    const f = r ? rows.findIndex((x) => x.id === r.focus) : -1
    const out = new Set<TreeID>()
    if (a < 0 || f < 0) {
      return out
    }
    for (const row of rows.slice(Math.min(a, f), Math.max(a, f) + 1)) {
      for (const id of subtree(this.doc, row.id)) {
        out.add(id)
      }
    }
    return out
  })

  // The selected rows whose parent is not selected, in reading order.
  roots(): TreeID[] {
    const sel = this.selected
    return this.rows.filter((r) => sel.has(r.id) && !(r.parent && sel.has(r.parent))).map((r) => r.id)
  }

  deleteSelected(): void {
    const roots = this.roots()
    if (!roots.length) {
      return
    }
    const sel = this.selected
    const first = this.#index(roots[0])
    const after = this.rows.slice(first).find((r) => !sel.has(r.id))
    const before = this.rows
      .slice(0, first)
      .reverse()
      .find((r) => !atomic.has(r.kind))
    this.range = null
    this.apply(() => {
      for (const id of roots) {
        ops.drop(this.doc, id)
      }
      if (after && !atomic.has(after.kind)) {
        return { id: after.id, anchor: 0, focus: 0 }
      }
      if (before) {
        const l = text(this.doc, before.id).length
        return { id: before.id, anchor: l, focus: l }
      }
      const n = ops.create(this.doc, undefined, 0, 'paragraph')
      return { id: n, anchor: 0, focus: 0 }
    })
  }

  // Move the selected roots one sibling up or down.
  shift(up: boolean): void {
    const roots = this.roots()
    if (!roots.length) {
      return
    }
    const anchor = up ? roots[0] : roots.at(-1)!
    const rows = this.rows
    const parent = rows.find((r) => r.id === anchor)?.parent
    const siblings = rows.filter((r) => r.parent === parent).map((r) => r.id)
    const i = siblings.indexOf(anchor)
    const other = siblings[up ? i - 1 : i + 1]
    if (!other || roots.some((id) => rows.find((r) => r.id === id)?.parent !== parent)) {
      return
    }
    this.apply(() => {
      ops.move(this.doc, other, up ? { after: roots.at(-1)! } : { before: roots[0] })
    })
  }

  edit(id: TreeID, atEnd = true): void {
    this.range = null
    const l = text(this.doc, id).length
    const at = atEnd ? l : 0
    this.#place({ id, anchor: at, focus: at })
  }

  // Keys on a block's editable.
  editKey(e: KeyboardEvent): void {
    if (e.isComposing || e.keyCode === 229) {
      return
    }
    if (this.slashKey(e)) {
      return
    }
    const mod = e.metaKey || e.ctrlKey
    const s = this.#sel()
    if (!s) {
      return
    }
    const key = e.key.toLowerCase()
    if (mod && !e.altKey && (key === 'b' || key === 'i' || key === 'e' || key === 'k')) {
      e.preventDefault()
      if (key === 'k') {
        this.link()
      } else {
        this.mark(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'code')
      }
      return
    }
    if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        this.doRedo()
      } else {
        this.doUndo()
      }
      return
    }
    if (mod && key === 'y') {
      e.preventDefault()
      this.doRedo()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      this.nest(e.shiftKey)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      this.select(s.id)
      return
    }
    const i = this.#index(s.id)
    const prev = this.rows[i - 1]
    const next = this.rows[i + 1]
    if (e.key === 'ArrowUp' && onFirstLine(s.el)) {
      if (e.shiftKey) {
        e.preventDefault()
        this.select(s.id, prev?.id ?? s.id)
        return
      }
      if (prev) {
        e.preventDefault()
        this.#vertical(prev, caretRect(s.el).left, true)
      }
      return
    }
    if (e.key === 'ArrowDown' && onLastLine(s.el)) {
      if (e.shiftKey) {
        e.preventDefault()
        this.select(s.id, next?.id ?? s.id)
        return
      }
      if (next) {
        e.preventDefault()
        this.#vertical(next, caretRect(s.el).left, false)
      }
      return
    }
    if (e.key === 'ArrowLeft' && !e.shiftKey && s.collapsed && s.start === 0 && prev) {
      e.preventDefault()
      if (atomic.has(prev.kind)) {
        this.select(prev.id)
      } else {
        this.edit(prev.id, true)
      }
      return
    }
    if (e.key === 'ArrowRight' && !e.shiftKey && s.collapsed && s.end === text(this.doc, s.id).length && next) {
      e.preventDefault()
      if (atomic.has(next.kind)) {
        this.select(next.id)
      } else {
        this.edit(next.id, false)
      }
    }
  }

  #vertical(row: View, x: number, up: boolean): void {
    if (atomic.has(row.kind)) {
      this.select(row.id)
      return
    }
    const el = this.#els.get(row.id)
    if (!el) {
      return
    }
    const r = el.getBoundingClientRect()
    const y = up ? r.bottom - 4 : r.top + 4
    const at = offsetAt(el, Math.min(Math.max(x, r.left + 1), r.right - 1), y)
    this.#place({ id: row.id, anchor: at, focus: at })
  }

  // Keys on the editor itself, while blocks are selected.
  blockKey(e: KeyboardEvent): void {
    const r = this.range
    if (!r) {
      return
    }
    const mod = e.metaKey || e.ctrlKey
    const fi = this.#index(r.focus)
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (mod || e.altKey) && e.shiftKey) {
      e.preventDefault()
      this.shift(e.key === 'ArrowUp')
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const to = this.rows[fi + (e.key === 'ArrowUp' ? -1 : 1)]
      if (!to) {
        return
      }
      if (e.shiftKey) {
        this.range = { anchor: r.anchor, focus: to.id }
      } else if (atomic.has(to.kind)) {
        this.select(to.id)
      } else {
        this.edit(to.id, e.key === 'ArrowUp')
      }
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      this.deleteSelected()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      this.nest(e.shiftKey)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      this.range = null
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = this.rows[fi]
      if (atomic.has(row.kind)) {
        this.apply(() => {
          const n = ops.after(this.doc, row.id, 'paragraph')
          return { id: n, anchor: 0, focus: 0 }
        })
      } else {
        this.edit(row.id)
      }
      return
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        this.doRedo()
      } else {
        this.doUndo()
      }
      return
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      this.range = { anchor: this.rows[0].id, focus: this.rows.at(-1)!.id }
    }
  }

  link(): void {
    const s = this.#sel()
    if (!s || s.collapsed) {
      return
    }
    const href = window.prompt('Link to', 'https://')
    if (href) {
      writeSel(s.el, s.anchor, s.focus)
      this.mark('link', href)
    }
  }

  doUndo(): void {
    if (this.undo.undo()) {
      this.flush()
    }
  }

  doRedo(): void {
    if (this.undo.redo()) {
      this.flush()
    }
  }

  // Pointer: a drag that leaves the block it started in turns into a block
  // selection, as Notion's does; native selection cannot span two
  // contenteditables.
  pointerdown(e: PointerEvent): void {
    const target = e.target as HTMLElement
    // Only a press in a block's text starts a drag-selection; the handle's
    // press starts a drag and drop.
    const el = target.closest<HTMLElement>('[data-block]')
    this.#press = (el?.dataset.block as TreeID | undefined) ?? null
    if (this.range && !(e.target as HTMLElement).closest('[data-handle]')) {
      this.range = null
    }
  }

  pointermove(e: PointerEvent): void {
    if (!this.#press || !(e.buttons & 1)) {
      return
    }
    const el = this.#rowAt(e.clientX, e.clientY)
    const over = el?.dataset.row as TreeID | undefined
    if (over && (over !== this.#press || this.range)) {
      if (!this.range || this.range.focus !== over) {
        this.select(this.#press, over)
      }
    }
  }

  // The row under a point, in this editor only: two editors share a page.
  #rowAt(x: number, y: number): HTMLElement | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-row]') ?? null
    return el && this.root?.contains(el) ? el : null
  }

  pointerup(): void {
    this.#press = null
  }

  // Clipboard: blocks travel as fragments, a range of text as runs, and
  // both as plain text for the world outside.
  copy(e: ClipboardEvent, cut: boolean): void {
    const data = e.clipboardData
    if (!data) {
      return
    }
    if (this.range) {
      e.preventDefault()
      const roots = this.roots()
      const fs = roots.map((id) => ops.fragment(this.doc, id))
      data.setData(blocksType, JSON.stringify(fs))
      data.setData('text/plain', plain(fs, 0))
      if (cut) {
        this.deleteSelected()
      }
      return
    }
    const s = this.#sel()
    if (!s || s.collapsed) {
      return
    }
    e.preventDefault()
    const t = text(this.doc, s.id)
    data.setData(runsType, JSON.stringify(ops.runs(t, s.start, s.end)))
    data.setData('text/plain', t.toString().slice(s.start, s.end))
    if (cut) {
      this.apply(() => {
        ops.remove(t, s.start, s.end - s.start)
        return { id: s.id, anchor: s.start, focus: s.start }
      })
    }
  }

  paste(e: ClipboardEvent): void {
    const data = e.clipboardData
    if (!data) {
      return
    }
    e.preventDefault()
    const blocks = data.getData(blocksType)
    const s = this.#sel()
    const anchorId = s?.id ?? this.roots().at(-1)
    if (!anchorId) {
      return
    }
    if (blocks) {
      const fs = JSON.parse(blocks) as ops.Fragment[]
      this.apply(() => {
        const empty = s && kind(this.doc, s.id) === 'paragraph' && text(this.doc, s.id).length === 0
        const ids = ops.paste(this.doc, parentOf(this.doc, anchorId), indexOf(this.doc, anchorId) + 1, fs)
        if (empty) {
          ops.drop(this.doc, anchorId)
        }
        const last = [...ids].reverse().find((id) => !atomic.has(kind(this.doc, id)))
        if (last) {
          const l = text(this.doc, last).length
          return { id: last, anchor: l, focus: l }
        }
      })
      return
    }
    if (!s) {
      return
    }
    const runsJson = data.getData(runsType)
    const t = text(this.doc, s.id)
    if (runsJson) {
      const rs = JSON.parse(runsJson) as ops.Run[]
      this.apply(() => {
        ops.remove(t, s.start, s.end - s.start)
        const n = ops.insertRuns(t, s.start, rs)
        return { id: s.id, anchor: s.start + n, focus: s.start + n }
      })
      return
    }
    const str = data.getData('text/plain').replaceAll('\r\n', '\n')
    const lines = kind(this.doc, s.id) === 'code' ? [str] : str.split('\n')
    this.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      if (lines.length === 1) {
        ops.insert(t, s.start, lines[0])
        return { id: s.id, anchor: s.start + lines[0].length, focus: s.start + lines[0].length }
      }
      const tail = ops.runs(t, s.start)
      ops.remove(t, s.start, t.length - s.start)
      ops.insert(t, s.start, lines[0], {})
      let prev = s.id
      for (const l of lines.slice(1)) {
        prev = ops.after(this.doc, prev, 'paragraph', {}, [{ text: l }])
      }
      const lt = text(this.doc, prev)
      const at = lt.length
      ops.insertRuns(lt, at, tail)
      return { id: prev, anchor: at, focus: at }
    })
  }

  // Drag and drop by the handle.
  dragstart(e: DragEvent, id: TreeID): void {
    const sel = this.selected
    this.#dragging = sel.has(id) ? this.roots() : [id]
    e.dataTransfer?.setData('text/plain', this.#dragging.map((x) => text(this.doc, x).toString()).join('\n'))
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  dragover(e: DragEvent): void {
    if (!this.#dragging.length) {
      return
    }
    e.preventDefault()
    const el = this.#rowAt(e.clientX, e.clientY)
    const id = el?.dataset.row as TreeID | undefined
    if (!el || !id) {
      return
    }
    const r = el.getBoundingClientRect()
    const content = el.querySelector<HTMLElement>('[data-content]')?.getBoundingClientRect().left ?? r.left
    const place = e.clientY < r.top + r.height / 2 ? 'before' : e.clientX > content + 48 ? 'into' : 'after'
    if (this.dropAt?.id !== id || this.dropAt.place !== place) {
      this.dropAt = { id, place }
    }
  }

  drop(e: DragEvent): void {
    const d = this.dropAt
    const moving = this.#dragging
    this.dropAt = null
    this.#dragging = []
    if (!d || !moving.length || moving.includes(d.id)) {
      return
    }
    e.preventDefault()
    this.apply(() => {
      let prev: TreeID | null = null
      for (const id of moving) {
        if (prev) {
          ops.move(this.doc, id, { after: prev })
        } else {
          ops.move(this.doc, id, d.place === 'before' ? { before: d.id } : d.place === 'after' ? { after: d.id } : { into: d.id })
        }
        prev = id
      }
    })
  }

  dragend(): void {
    this.dropAt = null
    this.#dragging = []
  }
}

function plain(fs: ops.Fragment[], depth: number): string {
  return fs
    .map((f) => {
      const t = f.runs.map((r) => r.text).join('')
      const line = `${'  '.repeat(depth)}${f.type === 'divider' ? '---' : f.type === 'decision' ? `[${f.decision}]` : t}`
      return f.children.length ? `${line}\n${plain(f.children, depth + 1)}` : line
    })
    .join('\n')
}
