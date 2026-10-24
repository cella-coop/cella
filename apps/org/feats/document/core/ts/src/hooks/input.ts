import type { Cursor } from 'loro-crdt'
import { atomic, exists, kind, text, type Kind, type Mark, type Marks, type Props, type TreeID } from '../models/blocks.ts'
import * as ops from '../models/edits.ts'
import { length, onFirstLine, onLastLine, type Sel } from './dom.ts'
import type { EditorState, Located } from './EditorState.svelte.ts'

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

type Composing = { id: TreeID; at: number; cursor: Cursor | undefined; done: boolean }

// Typing into a block. The browser asks before it edits; every edit is
// refused and made in Loro instead, using the browser's target range for
// grapheme, word and spelling edits, except composition, which the IME
// owns until it ends: then the block is painted again from Loro and the
// composed text inserted at a Loro cursor taken where it began.
export class Input {
  readonly #ed: EditorState
  composing: Composing | null = null
  // Marks toggled with no range, for the next text typed at this caret.
  #pending: { marks: Marks; id: TreeID; at: number } | null = null

  constructor(ed: EditorState) {
    this.#ed = ed
  }

  // The caret moved: pending marks hold only where they were toggled.
  moved(s: Located | null): void {
    const p = this.#pending
    if (p && (!s || s.id !== p.id || !s.collapsed || s.start !== p.at)) {
      this.#pending = null
    }
  }

  #marks(id: TreeID): Marks | undefined {
    return this.#pending?.id === id ? this.#pending.marks : undefined
  }

  #keep(id: TreeID, at: number): void {
    if (this.#pending?.id === id) {
      this.#pending = { ...this.#pending, at }
    }
  }

  insert(s: Sel & { id: TreeID }, data: string): void {
    const ed = this.#ed
    const t = text(ed.doc, s.id)
    ed.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      ops.insert(t, s.start, data, this.#marks(s.id))
      this.#keep(s.id, s.start + data.length)
      return { id: s.id, anchor: s.start + data.length, focus: s.start + data.length }
    })
    this.#afterType(s.id, s.start, data)
  }

  #afterType(id: TreeID, at: number, data: string): void {
    const ed = this.#ed
    const t = text(ed.doc, id)
    const k = kind(ed.doc, id)
    const before = t.toString().slice(0, at + data.length)
    if (data === '/' && (at === 0 || /\s/.test(before.at(-2) ?? ''))) {
      ed.menu.open(id, at)
      return
    }
    if (k === 'code') {
      return
    }
    if (before === '---') {
      ed.apply(() => {
        ops.remove(t, 0, 3)
        ops.retype(ed.doc, id, 'divider')
        const n = ops.after(ed.doc, id, 'paragraph', {}, ops.runs(t))
        ops.remove(t, 0, t.length)
        return { id: n, anchor: 0, focus: 0 }
      })
      return
    }
    if (data !== ' ') {
      return
    }
    const head = before.slice(0, -1)
    if (k === 'heading') {
      const m = /^(#{1,3})$/.exec(head)
      if (m) {
        ed.apply(() => {
          ops.remove(t, 0, head.length + 1)
          ops.retype(ed.doc, id, 'heading', { level: m[1].length })
          return { id, anchor: 0, focus: 0 }
        })
      }
      return
    }
    for (const [re, nk, p] of shortcuts) {
      if (re.test(head) && k !== nk) {
        ed.apply(() => {
          ops.remove(t, 0, head.length + 1)
          ops.retype(ed.doc, id, nk, p)
          return { id, anchor: 0, focus: 0 }
        })
        return
      }
    }
  }

  beforeinput(e: InputEvent): void {
    const type = e.inputType
    if (type === 'insertCompositionText') {
      return
    }
    e.preventDefault()
    const ed = this.#ed
    const s = ed.sel()
    if (!s) {
      return
    }
    const t = text(ed.doc, s.id)
    switch (type) {
      case 'insertText':
      case 'insertReplacementText': {
        const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? ''
        this.insert({ ...s, ...this.#target(e, s) }, data)
        return
      }
      case 'insertFromComposition': {
        // Safari ends a composition with a cancelable insert.
        if (this.composing) {
          this.#commitComposition(e.data ?? '')
        }
        return
      }
      case 'insertParagraph':
        this.enter(s)
        return
      case 'insertLineBreak':
        this.insert(s, '\n')
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
        ed.apply(() => {
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
        ed.doUndo()
        return
      case 'historyRedo':
        ed.doRedo()
        return
    }
  }

  // The range the browser means to edit: its target range when it gives
  // one (a grapheme, a word, a spelling fix), the selection if not.
  #target(e: InputEvent, s: Located): { start: number; end: number } {
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
    const str = text(this.#ed.doc, s.id).toString()
    return { start: ops.snap(str, start), end: ops.snap(str, end) }
  }

  compositionstart(): void {
    const ed = this.#ed
    const s = ed.sel()
    if (!s) {
      return
    }
    if (!s.collapsed) {
      // Clear the selection before the IME draws over it.
      ed.apply(() => {
        ops.remove(text(ed.doc, s.id), s.start, s.end - s.start)
        return { id: s.id, anchor: s.start, focus: s.start }
      })
    }
    this.composing = { id: s.id, at: s.start, cursor: text(ed.doc, s.id).getCursor(s.start), done: false }
  }

  compositionend(e: CompositionEvent): void {
    const c = this.composing
    if (!c) {
      return
    }
    if (!c.done) {
      this.#commitComposition(e.data ?? '')
    }
    this.composing = null
    this.#ed.flush()
  }

  #commitComposition(data: string): void {
    const ed = this.#ed
    const c = this.composing
    if (!c) {
      return
    }
    c.done = true
    const id = c.id
    this.composing = null
    if (!exists(ed.doc, id)) {
      return
    }
    const t = text(ed.doc, id)
    // Where the composition began, after any remote edit made meanwhile.
    const at = Math.min((c.cursor && ed.doc.getCursorPos(c.cursor)?.offset) ?? c.at, t.length)
    ed.dirty(id)
    if (data) {
      ed.apply(() => {
        ops.insert(t, at, data, this.#marks(id))
        this.#keep(id, at + data.length)
        return { id, anchor: at + data.length, focus: at + data.length }
      })
      this.#afterType(id, at, data)
    } else {
      ed.flush()
    }
    this.composing = { ...c, at }
  }

  enter(s: Sel & { id: TreeID }): void {
    const ed = this.#ed
    const k = kind(ed.doc, s.id)
    const t = text(ed.doc, s.id)
    if (k === 'code') {
      this.insert(s, '\n')
      return
    }
    // Enter on an empty list item ends the list, as an outline does.
    if (t.length === 0 && (k === 'bullet' || k === 'numbered' || k === 'todo' || k === 'quote')) {
      ed.apply(() => {
        if (!ops.outdent(ed.doc, s.id)) {
          ops.retype(ed.doc, s.id, 'paragraph')
        }
        return { id: s.id, anchor: 0, focus: 0 }
      })
      return
    }
    ed.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      const id = ops.split(ed.doc, s.id, s.start)
      return { id, anchor: 0, focus: 0 }
    })
  }

  backspaceAtStart(id: TreeID): void {
    const ed = this.#ed
    if (kind(ed.doc, id) !== 'paragraph') {
      ed.apply(() => {
        ops.retype(ed.doc, id, 'paragraph')
        return { id, anchor: 0, focus: 0 }
      })
      return
    }
    const prev = ed.rows[ed.index(id) - 1]
    if (!prev) {
      return
    }
    if (atomic.has(prev.kind)) {
      if (text(ed.doc, id).length === 0) {
        ed.apply(() => {
          ops.drop(ed.doc, id)
        })
      }
      ed.chosen.select(prev.id)
      return
    }
    ed.apply(() => {
      const at = ops.merge(ed.doc, prev.id, id)
      return { id: prev.id, anchor: at, focus: at }
    })
  }

  deleteAtEnd(id: TreeID): void {
    const ed = this.#ed
    const next = ed.rows[ed.index(id) + 1]
    if (!next) {
      return
    }
    if (atomic.has(next.kind)) {
      ed.chosen.select(next.id)
      return
    }
    ed.apply(() => {
      const at = ops.merge(ed.doc, id, next.id)
      return { id, anchor: at, focus: at }
    })
  }

  // Toggle a mark over the selection, or with no range, for the next text
  // typed at the caret. A link needs its address, which the toolbar asks.
  mark(key: Mark, href?: string, at: Located | null = this.#ed.sel()): void {
    const ed = this.#ed
    const s = at
    if (!s) {
      return
    }
    const t = text(ed.doc, s.id)
    if (s.collapsed) {
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
    ed.apply(() => {
      ops.toggle(t, s.start, s.end, key, key === 'link' ? (href ?? '') : true)
      return { id: s.id, anchor: s.anchor, focus: s.focus }
    })
  }

  // Keys on a block's editable.
  key(e: KeyboardEvent): void {
    const ed = this.#ed
    if (e.isComposing || e.keyCode === 229) {
      return
    }
    if (ed.menu.key(e)) {
      return
    }
    const mod = e.metaKey || e.ctrlKey
    const s = ed.sel()
    if (!s) {
      return
    }
    const key = e.key.toLowerCase()
    if (mod && !e.altKey && (key === 'b' || key === 'i' || key === 'e' || key === 'k')) {
      // The page has its own Ctrl-K, the command menu; in a block, the
      // key is the editor's.
      e.preventDefault()
      e.stopPropagation()
      if (key === 'k') {
        ed.menu.link()
      } else {
        this.mark(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'code')
      }
      return
    }
    if (mod && key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        ed.doRedo()
      } else {
        ed.doUndo()
      }
      return
    }
    if (mod && key === 'y') {
      e.preventDefault()
      ed.doRedo()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      ed.chosen.nest(e.shiftKey)
      return
    }
    // WebKit asks nothing before a Backspace at a block's start or a
    // Delete at its end, where the block holds nothing to delete.
    if (e.key === 'Backspace' && !mod && !e.altKey && s.collapsed && s.start === 0) {
      e.preventDefault()
      this.backspaceAtStart(s.id)
      return
    }
    if (e.key === 'Delete' && !mod && !e.altKey && s.collapsed && s.end === text(ed.doc, s.id).length) {
      e.preventDefault()
      this.deleteAtEnd(s.id)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      ed.chosen.select(s.id)
      return
    }
    const i = ed.index(s.id)
    const prev = ed.rows[i - 1]
    const next = ed.rows[i + 1]
    if (e.key === 'ArrowUp' && onFirstLine(s.el)) {
      if (e.shiftKey) {
        e.preventDefault()
        ed.chosen.select(s.id, prev?.id ?? s.id)
        return
      }
      if (prev) {
        e.preventDefault()
        ed.vertical(prev, ed.caret(s.el).left, true)
      }
      return
    }
    if (e.key === 'ArrowDown' && onLastLine(s.el)) {
      if (e.shiftKey) {
        e.preventDefault()
        ed.chosen.select(s.id, next?.id ?? s.id)
        return
      }
      if (next) {
        e.preventDefault()
        ed.vertical(next, ed.caret(s.el).left, false)
      }
      return
    }
    if (e.key === 'ArrowLeft' && !e.shiftKey && s.collapsed && s.start === 0 && prev) {
      e.preventDefault()
      if (atomic.has(prev.kind)) {
        ed.chosen.select(prev.id)
      } else {
        ed.edit(prev.id, true)
      }
      return
    }
    if (e.key === 'ArrowRight' && !e.shiftKey && s.collapsed && s.end === text(ed.doc, s.id).length && next) {
      e.preventDefault()
      if (atomic.has(next.kind)) {
        ed.chosen.select(next.id)
      } else {
        ed.edit(next.id, false)
      }
    }
  }
}
