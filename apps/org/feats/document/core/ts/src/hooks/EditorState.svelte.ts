import { flushSync } from 'svelte'
import { Cursor, UndoManager, type Delta, type LoroDoc, type LoroEventBatch } from 'loro-crdt'
import type { DragState, Embeds } from '@cella/org-ui'
import { atomic, exists, kind, order, props, text, type Kind, type Props, type TreeID } from '../models/blocks.ts'
import * as ops from '../models/edits.ts'
import { b64, type Anchor } from '../models/document.ts'
import { caretRect, offsetAt, paint, readSel, writeSel, type Sel, type Span } from './dom.ts'
import { ChoiceState } from './ChoiceState.svelte.ts'
import { MenuState } from './MenuState.svelte.ts'
import { Input } from './input.ts'
import { Clipboard } from './clipboard.ts'

// One block as it is drawn. A view object is replaced only when its
// drawing changes, so Svelte redraws only those blocks; text is painted
// into the block's editable directly, not by Svelte.
export type View = {
  id: TreeID
  parent: TreeID | undefined
  depth: number
  kind: Kind
  props: Props
  number: number
  children: TreeID[]
}

export type Want = { id: TreeID; anchor: number; focus: number }
type Caret = { id: TreeID; anchor: Cursor; focus: Cursor }
export type Located = Sel & { id: TreeID; el: HTMLElement }

// The editor over one Loro document: the blocks as views, the caret as
// Loro cursors, and the painting of each block's text from Loro. Input,
// block selection, the menus and the clipboard are its parts, each over
// this state; live sync is the page's, over the same document.
export class EditorState {
  readonly doc: LoroDoc
  readonly undo: UndoManager
  readonly drag: DragState
  readonly input: Input
  readonly chosen: ChoiceState
  readonly menu: MenuState
  readonly clip: Clipboard
  // What the page's slices draw inside the document, by kind.
  readonly embeds: () => Embeds

  views: Map<TreeID, View> = $state.raw(new Map())
  rows: View[] = $state.raw([])
  roots: TreeID[] = $state.raw([])
  // The editor took over from the server's rendering of the draft.
  ready = $state(false)

  root: HTMLElement | null = null
  readonly #els = new Map<TreeID, HTMLElement>()
  #dirty = new Set<TreeID>()
  #structure = true
  #scheduled = false
  #want: Want | null = null
  #caret: Caret | null = null
  #remote: Want | null = null
  #spans = new Map<TreeID, { from: Cursor; to: Cursor }[]>()
  #observer: MutationObserver | null = null
  readonly #unsubscribe: () => void

  constructor(doc: LoroDoc, drag: DragState, anchors: Anchor[] = [], embeds: () => Embeds = () => ({})) {
    this.doc = doc
    this.drag = drag
    this.embeds = embeds
    for (const a of anchors) {
      const from = Cursor.decode(b64.decode(a.from))
      const to = Cursor.decode(b64.decode(a.to))
      this.#spans.set(a.block, [...(this.#spans.get(a.block) ?? []), { from, to }])
    }
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
    this.input = new Input(this)
    this.chosen = new ChoiceState(this)
    this.menu = new MenuState(this)
    this.clip = new Clipboard(this)
    this.#unsubscribe = doc.subscribe((batch) => this.#events(batch))
    this.#rebuild()
  }

  attach(el: HTMLElement): () => void {
    this.root = el
    // Anything that changes a block's text behind the editor's back, a
    // browser's own edit it did not ask first or an extension rewriting
    // the page, is undone by painting the block again from Loro.
    this.#observer = new MutationObserver((records) => this.#foreign(records))
    for (const [, block] of this.#els) {
      this.#watch(block)
    }
    this.ready = true
    return () => {
      this.#observer?.disconnect()
      this.#observer = null
      this.root = null
      this.#unsubscribe()
      this.undo.free()
    }
  }

  #watch(el: HTMLElement): void {
    this.#observer?.observe(el, { childList: true, characterData: true, subtree: true })
  }

  #foreign(records: MutationRecord[]): void {
    for (const r of records) {
      const el = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest<HTMLElement>('[data-block]')
      const id = el?.dataset.block as TreeID | undefined
      if (id && this.#els.get(id) === el && this.input.composing?.id !== id) {
        this.#dirty.add(id)
      }
    }
    if (this.#dirty.size) {
      this.flush()
    }
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
    const kids = new Map<string, TreeID[]>()
    for (const r of order(this.doc)) {
      const scope = r.parent ?? ''
      kids.set(scope, [...(kids.get(scope) ?? []), r.id])
    }
    for (const r of order(this.doc)) {
      const k = kind(this.doc, r.id)
      const scope = r.parent ?? ''
      const n = k === 'numbered' ? (last.get(scope) === 'numbered' ? (count.get(scope) ?? 0) + 1 : 1) : 0
      count.set(scope, n)
      last.set(scope, k)
      const p = props(this.doc, r.id)
      const children = kids.get(r.id) ?? []
      const old = this.views.get(r.id)
      const v =
        old &&
        old.depth === r.depth &&
        old.parent === r.parent &&
        old.kind === k &&
        old.number === n &&
        JSON.stringify(old.props) === JSON.stringify(p) &&
        old.children.join() === children.join()
          ? old
          : { id: r.id, parent: r.parent, depth: r.depth, kind: k, props: p, number: n, children }
      next.set(r.id, v)
      rows.push(v)
    }
    const roots = kids.get('') ?? []
    this.views = next
    this.rows = rows
    if (roots.join() !== this.roots.join()) {
      this.roots = roots
    }
  }

  #paint(id: TreeID, el: HTMLElement): void {
    const spans: Span[] = []
    for (const s of this.#spans.get(id) ?? []) {
      const from = this.doc.getCursorPos(s.from)?.offset
      const to = this.doc.getCursorPos(s.to)?.offset
      if (from !== undefined && to !== undefined && from < to) {
        spans.push({ from, to })
      }
    }
    paint(el, ops.runs(text(this.doc, id)), spans)
  }

  flush(): void {
    this.#scheduled = false
    if (this.#structure) {
      this.#structure = false
      this.#rebuild()
      this.chosen.prune()
      this.menu.prune()
      flushSync()
    }
    const focused = this.focusedId()
    let kept: Want | null = null
    for (const id of this.#dirty) {
      if (this.input.composing?.id === id) {
        continue
      }
      const el = this.#els.get(id)
      if (el && exists(this.doc, id)) {
        // Repainting drops the DOM selection inside; keep it where it was.
        const s = id === focused ? readSel(el) : null
        this.#paint(id, el)
        if (s) {
          kept = { id, anchor: s.anchor, focus: s.focus }
        }
      }
      this.#dirty.delete(id)
    }
    this.#observer?.takeRecords()
    if (this.#want) {
      this.place(this.#want)
    } else if (this.#remote && !this.input.composing) {
      // A remote edit redrew the block under the caret: put it back where
      // the edit moved it, so it never jumps.
      const el = this.#els.get(this.#remote.id)
      if (el && (focused === this.#remote.id || document.activeElement === document.body)) {
        writeSel(el, this.#remote.anchor, this.#remote.focus)
      }
    } else if (kept) {
      const el = this.#els.get(kept.id)
      if (el) {
        writeSel(el, kept.anchor, kept.focus)
      }
    }
    this.#remote = null
  }

  // Marks a block to repaint at the next flush, as a composition's end
  // does.
  dirty(id: TreeID): void {
    this.#dirty.add(id)
  }

  // Carry the caret through a remote text edit, from the DOM's selection,
  // which still shows the text before it until the flush repaints. Cursors
  // taken on selectionchange would do the same, but that event lags the
  // keys that move the caret, and a remote edit can land in between.
  #shiftCaret(id: TreeID, delta: Delta<string>[]): void {
    if (this.input.composing?.id === id) {
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

  place(w: Want): void {
    const el = this.#els.get(w.id)
    if (!el) {
      this.#want = w
      return
    }
    this.#want = null
    this.chosen.clear()
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
    this.#paint(id, el)
    this.#dirty.delete(id)
    this.#watch(el)
    this.#observer?.takeRecords()
    if (this.#want?.id === id) {
      this.place(this.#want)
    }
    return () => {
      if (this.#els.get(id) === el) {
        this.#els.delete(id)
      }
    }
  }

  element(id: TreeID): HTMLElement | undefined {
    return this.#els.get(id)
  }

  focusedId(): TreeID | null {
    const a = document.activeElement as HTMLElement | null
    const id = a?.dataset.block as TreeID | undefined
    return id && this.#els.get(id) === a ? id : null
  }

  sel(): Located | null {
    const id = this.focusedId()
    if (!id) {
      return null
    }
    const el = this.#els.get(id)
    const s = el ? readSel(el) : null
    if (!el || !s) {
      return null
    }
    // A selection the browser leaves inside a surrogate pair, which Loro
    // refuses, snaps to the code point's start.
    const str = text(this.doc, id).toString()
    const anchor = ops.snap(str, s.anchor)
    const focus = ops.snap(str, s.focus)
    return { anchor, focus, start: Math.min(anchor, focus), end: Math.max(anchor, focus), collapsed: anchor === focus, id, el }
  }

  // Keep the caret as Loro cursors, which survive remote edits, and keep
  // the toolbar and slash menu in step with it.
  track(): void {
    if (this.input.composing) {
      return
    }
    const s = this.sel()
    if (!s) {
      this.menu.away()
      return
    }
    const t = text(this.doc, s.id)
    const anchor = t.getCursor(s.anchor)
    const focus = t.getCursor(s.focus)
    if (anchor && focus) {
      this.#caret = { id: s.id, anchor, focus }
    }
    this.menu.follow(s, t.toString())
  }

  selectionChanged(): void {
    this.input.moved(this.sel())
    this.track()
  }

  index(id: TreeID): number {
    return this.rows.findIndex((r) => r.id === id)
  }

  // Put the caret at a text block's end or start.
  edit(id: TreeID, atEnd = true): void {
    this.chosen.clear()
    const l = text(this.doc, id).length
    const at = atEnd ? l : 0
    this.place({ id, anchor: at, focus: at })
  }

  // Move the caret into a block above or below at the same x, or choose it
  // whole when it holds no text.
  vertical(row: View, x: number, up: boolean): void {
    if (atomic.has(row.kind)) {
      this.chosen.select(row.id)
      return
    }
    const el = this.#els.get(row.id)
    if (!el) {
      return
    }
    const r = el.getBoundingClientRect()
    const y = up ? r.bottom - 4 : r.top + 4
    const at = offsetAt(el, Math.min(Math.max(x, r.left + 1), r.right - 1), y)
    this.place({ id: row.id, anchor: at, focus: at })
  }

  caret(el: HTMLElement): DOMRect {
    return caretRect(el)
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

  // A block dropped by its grip, or the chosen blocks with it, before the
  // block that sits at `to` among the others in reading order, or after
  // the last; never into its own subtree.
  dropAt(from: number, to: number): void {
    const lifted = this.rows[from]?.id
    if (!lifted) {
      return
    }
    const moving = this.chosen.selected.has(lifted) ? this.chosen.roots() : [lifted]
    const others = this.rows.filter((r) => r.id !== lifted)
    const target = others[to]
    const inside = new Set(moving.flatMap((id) => this.subtree(id)))
    if (target && inside.has(target.id)) {
      return
    }
    this.apply(() => {
      let prev: TreeID | null = null
      for (const id of moving) {
        if (prev) {
          ops.move(this.doc, id, { after: prev })
        } else if (target) {
          ops.move(this.doc, id, { before: target.id })
        } else {
          const last = this.roots.filter((r) => !inside.has(r)).at(-1)
          if (last) {
            ops.move(this.doc, id, { after: last })
          }
        }
        prev = id
      }
    })
  }

  subtree(id: TreeID): TreeID[] {
    const v = this.views.get(id)
    return [id, ...(v?.children ?? []).flatMap((c) => this.subtree(c))]
  }
}
