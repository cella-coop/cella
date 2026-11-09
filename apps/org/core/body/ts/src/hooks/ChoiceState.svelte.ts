import { flushSync } from 'svelte'
import { atomic, exists, text, type TreeID } from '../models/blocks.ts'
import * as ops from '../models/edits.ts'
import type { EditorState } from './EditorState.svelte.ts'

// Blocks chosen whole, as Notion chooses them: native selection cannot
// span two editable blocks, so a selection across blocks is a range of
// blocks, from an anchor to a focus in reading order, grown to cover
// their subtrees. Shift and an arrow at a block's edge, Escape, a click
// on a grip or on an atomic block, or a drag leaving its block choose
// them; they delete, copy, cut, nest and move together.
export class ChoiceState {
  readonly #ed: EditorState
  range: { anchor: TreeID; focus: TreeID } | null = $state.raw(null)
  #press: TreeID | null = null

  constructor(ed: EditorState) {
    this.#ed = ed
  }

  selected: Set<TreeID> = $derived.by(() => {
    const r = this.range
    const rows = this.#ed.rows
    const out = new Set<TreeID>()
    const a = r ? rows.findIndex((x) => x.id === r.anchor) : -1
    const f = r ? rows.findIndex((x) => x.id === r.focus) : -1
    if (a < 0 || f < 0) {
      return out
    }
    for (const row of rows.slice(Math.min(a, f), Math.max(a, f) + 1)) {
      for (const id of this.#ed.subtree(row.id)) {
        out.add(id)
      }
    }
    return out
  })

  select(anchor: TreeID, focus: TreeID = anchor): void {
    this.#ed.menu.close()
    this.#ed.root?.focus({ preventScroll: true })
    this.#to({ anchor, focus })
  }

  // A choice of blocks, mirrored in the page's selection over the same
  // blocks, unpainted: a browser fires copy and cut only over a selection
  // (Firefox does not otherwise).
  #to(range: { anchor: TreeID; focus: TreeID }): void {
    this.range = range
    flushSync()
    const root = this.#ed.root
    const a = root?.querySelector(`[data-row="${range.anchor}"]`)
    const f = root?.querySelector(`[data-row="${range.focus}"]`)
    const s = document.getSelection()
    if (!a || !f || !s) {
      return
    }
    const [first, last] = a.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_PRECEDING ? [f, a] : [a, f]
    const r = document.createRange()
    r.setStartBefore(first)
    r.setEndAfter(last)
    s.removeAllRanges()
    s.addRange(r)
  }

  clear(): void {
    if (this.range) {
      this.range = null
    }
  }

  // Drops a range whose ends a remote edit deleted.
  prune(): void {
    const r = this.range
    if (r && !(exists(this.#ed.doc, r.anchor) && exists(this.#ed.doc, r.focus))) {
      this.range = null
    }
  }

  // The chosen blocks whose parent is not chosen, in reading order.
  roots(): TreeID[] {
    const sel = this.selected
    return this.#ed.rows.filter((r) => sel.has(r.id) && !(r.parent && sel.has(r.parent))).map((r) => r.id)
  }

  delete(): void {
    const ed = this.#ed
    const roots = this.roots()
    if (!roots.length) {
      return
    }
    const sel = this.selected
    const first = ed.index(roots[0])
    const after = ed.rows.slice(first).find((r) => !sel.has(r.id))
    const before = ed.rows
      .slice(0, first)
      .reverse()
      .find((r) => !atomic.has(r.kind))
    this.range = null
    ed.apply(() => {
      for (const id of roots) {
        ops.drop(ed.doc, id)
      }
      if (after && !atomic.has(after.kind)) {
        return { id: after.id, anchor: 0, focus: 0 }
      }
      if (before) {
        const l = text(ed.doc, before.id).length
        return { id: before.id, anchor: l, focus: l }
      }
      const n = ops.create(ed.doc, undefined, 0, 'paragraph')
      return { id: n, anchor: 0, focus: 0 }
    })
  }

  // Move the chosen blocks one sibling up or down.
  shift(up: boolean): void {
    const ed = this.#ed
    const roots = this.roots()
    if (!roots.length) {
      return
    }
    const anchor = up ? roots[0] : roots[roots.length - 1]
    const rows = ed.rows
    const parent = rows.find((r) => r.id === anchor)?.parent
    const siblings = rows.filter((r) => r.parent === parent).map((r) => r.id)
    const i = siblings.indexOf(anchor)
    const other = siblings[up ? i - 1 : i + 1]
    if (!other || roots.some((id) => rows.find((r) => r.id === id)?.parent !== parent)) {
      return
    }
    ed.apply(() => {
      ops.move(ed.doc, other, up ? { after: roots[roots.length - 1] } : { before: roots[0] })
    })
  }

  // Tab and Shift-Tab: on the caret's block, or on the chosen blocks.
  nest(out: boolean): void {
    const ed = this.#ed
    const focused = ed.focusedId()
    const ids = this.range ? this.roots() : focused ? [focused] : []
    const s = ed.sel()
    ed.apply(() => {
      for (const id of out ? [...ids].reverse() : ids) {
        if (out) {
          ops.outdent(ed.doc, id)
        } else {
          ops.indent(ed.doc, id)
        }
      }
      return s ? { id: s.id, anchor: s.anchor, focus: s.focus } : undefined
    })
  }

  // Keys on the editor while blocks are chosen.
  key(e: KeyboardEvent): void {
    const ed = this.#ed
    const r = this.range
    if (!r) {
      return
    }
    const mod = e.metaKey || e.ctrlKey
    const fi = ed.index(r.focus)
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && (mod || e.altKey) && e.shiftKey) {
      e.preventDefault()
      this.shift(e.key === 'ArrowUp')
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const to = ed.rows[fi + (e.key === 'ArrowUp' ? -1 : 1)]
      if (!to) {
        return
      }
      if (e.shiftKey) {
        this.#to({ anchor: r.anchor, focus: to.id })
      } else if (atomic.has(to.kind)) {
        this.select(to.id)
      } else {
        ed.edit(to.id, e.key === 'ArrowUp')
      }
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      this.delete()
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
      document.getSelection()?.removeAllRanges()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const row = ed.rows[fi]
      if (atomic.has(row.kind)) {
        ed.apply(() => {
          const n = ops.after(ed.doc, row.id, 'paragraph')
          return { id: n, anchor: 0, focus: 0 }
        })
      } else {
        ed.edit(row.id)
      }
      return
    }
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        ed.doRedo()
      } else {
        ed.doUndo()
      }
      return
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      this.#to({ anchor: ed.rows[0].id, focus: ed.rows[ed.rows.length - 1].id })
    }
  }

  // A press in a block's text may become a drag across blocks; a press
  // anywhere but a grip ends a choice of blocks.
  pointerdown(e: PointerEvent): void {
    const target = e.target as HTMLElement
    const el = target.closest<HTMLElement>('[data-block]')
    this.#press = (el?.dataset.block as TreeID | undefined) ?? null
    if (this.range && !target.closest('[data-drag-handle]')) {
      this.range = null
    }
  }

  // A press outside the editor ends a choice of blocks too.
  away(e: PointerEvent): void {
    const t = e.target
    if (this.range && !(t instanceof Node && this.#ed.root?.contains(t))) {
      this.range = null
    }
  }

  // Whether the page's selection still mirrors the choice, as Chromium
  // leaves it, rather than holding text selected elsewhere on the page.
  mirrored(): boolean {
    const root = this.#ed.root
    const s = document.getSelection()
    return !!this.range && !!root && !!s && s.rangeCount > 0 && s.getRangeAt(0).intersectsNode(root)
  }

  pointermove(e: PointerEvent): void {
    if (!this.#press || !(e.buttons & 1) || this.#ed.drag.lifted) {
      return
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row]')
    const over = el && this.#ed.root?.contains(el) ? (el.dataset.row as TreeID) : undefined
    if (over && (over !== this.#press || this.range)) {
      if (!this.range || this.range.focus !== over) {
        this.select(this.#press, over)
      }
    }
  }

  pointerup(): void {
    this.#press = null
  }
}
