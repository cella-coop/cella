import { flushSync } from 'svelte'
import { atomic, exists, text, type Kind, type Props, type TreeID } from '../models/blocks.ts'
import * as ops from '../models/edits.ts'
import type { EditorState, Located } from './EditorState.svelte.ts'

export type Item = { label: string; hint: string; kind: Kind; props?: Props }

// What `/` turns a block into; the embeds a page offers follow.
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
]

// The menu sits below the caret, at `y`, or above it, its bottom at
// `above`, where below would pass the window's bottom.
type Slash = { id: TreeID; at: number; index: number; x: number; y: number; above: number }

// The editor's floating chrome: the slash menu at the caret, filtered by
// what is typed after the `/`, and the toolbar over a selection, with the
// link it asks an address for in the UI core's popover.
export class MenuState {
  readonly #ed: EditorState
  slash: Slash | null = $state.raw(null)
  query = $state('')
  bar: { x: number; y: number } | null = $state.raw(null)
  // The selection a link is being made on, held while its address is
  // typed, when the caret is in the popover and not the block.
  linking: Located | null = $state.raw(null)
  href = $state('https://')

  constructor(ed: EditorState) {
    this.#ed = ed
  }

  // The embeds the page offers, one item a kind: choosing one inserts the
  // kind's block empty, and the block asks which record it shows.
  offers: Item[] = $derived.by(() =>
    Object.entries(this.#ed.embeds())
      .filter(([, e]) => (e.embed.choices?.(e.data) ?? []).length > 0)
      .map(([embed, e]) => ({ label: e.embed.label, hint: 'embed', kind: 'embed' as const, props: { embed } })),
  )

  // An embed block inserted empty takes the record its picker chose, and
  // the caret goes on to the paragraph after it, made if none follows.
  pick(id: TreeID, embed: string, ref: string): void {
    const ed = this.#ed
    const next = ed.rows[ed.index(id) + 1]
    ed.apply(() => {
      ops.retype(ed.doc, id, 'embed', { embed, ref })
      const to = next && !atomic.has(next.kind) ? next.id : ops.after(ed.doc, id, 'paragraph')
      return { id: to, anchor: 0, focus: 0 }
    })
  }

  matches: Item[] = $derived.by(() => {
    const q = this.query.toLowerCase()
    return [...items, ...this.offers].filter((i) => i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
  })

  open(id: TreeID, at: number): void {
    const el = this.#ed.element(id)
    const r = el ? this.#ed.caret(el) : { left: 0, top: 0, bottom: 0 }
    this.query = ''
    this.slash = { id, at, index: 0, x: r.left, y: r.bottom + 4, above: r.top - 4 }
  }

  close(): void {
    this.slash = null
    this.bar = null
  }

  prune(): void {
    if (this.slash && !exists(this.#ed.doc, this.slash.id)) {
      this.slash = null
    }
  }

  // The page moved under the caret, by a resize or a scroll: the toolbar
  // and the menu go where it now is.
  reflow(): void {
    const s = this.#ed.sel()
    if (!s || (!this.bar && !this.slash)) {
      return
    }
    const r = this.#ed.caret(s.el)
    if (this.bar && !s.collapsed) {
      this.bar = { x: r.left, y: r.top - 40 }
    }
    if (this.slash) {
      this.slash = { ...this.slash, x: r.left, y: r.bottom + 4, above: r.top - 4 }
    }
  }

  // The caret left the blocks: the toolbar goes, unless a link is being
  // made on its selection.
  away(): void {
    if (!this.linking) {
      this.bar = null
    }
  }

  // The caret moved within a block: the toolbar follows a selection, and
  // the slash menu filters by what follows the `/`, or closes.
  follow(s: Located, t: string): void {
    const l = this.linking
    if (l && (l.id !== s.id || l.start !== s.start || l.end !== s.end)) {
      this.linking = null
    }
    if (s.collapsed) {
      this.bar = null
    } else {
      const r = this.#ed.caret(s.el)
      this.bar = { x: r.left, y: r.top - 40 }
    }
    const sl = this.slash
    if (sl) {
      const q = t.slice(sl.at + 1, s.focus)
      if (sl.id !== s.id || s.focus <= sl.at || q.includes('\n') || q.length > 20) {
        this.slash = null
      } else if (q !== this.query) {
        this.query = q
        this.slash = { ...sl, index: 0 }
      }
    }
  }

  choose(item: Item): void {
    const ed = this.#ed
    const sl = this.slash
    if (!sl) {
      return
    }
    this.slash = null
    const t = text(ed.doc, sl.id)
    const end = sl.at + 1 + this.query.length
    ed.apply(() => {
      ops.remove(t, sl.at, Math.min(end, t.length) - sl.at)
      if (atomic.has(item.kind)) {
        const empty = t.length === 0
        const target = empty ? sl.id : ops.after(ed.doc, sl.id, item.kind, item.props)
        if (empty) {
          ops.retype(ed.doc, sl.id, item.kind, item.props)
        }
        const n = ops.after(ed.doc, target, 'paragraph')
        return { id: n, anchor: 0, focus: 0 }
      }
      ops.retype(ed.doc, sl.id, item.kind, item.props)
      return { id: sl.id, anchor: sl.at, focus: sl.at }
    })
  }

  // Keys while the slash menu is open; true when it took the key.
  key(e: KeyboardEvent): boolean {
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

  // Ask for a link's address on the selection, in the toolbar's popover:
  // Ctrl-K, or the toolbar's Link.
  link(): void {
    const s = this.#ed.sel()
    if (!s || s.collapsed) {
      return
    }
    const t = text(this.#ed.doc, s.id)
    const had = ops.runs(t, s.start, s.end).find((r) => typeof r.marks?.link === 'string')?.marks?.link
    this.href = typeof had === 'string' ? had : 'https://'
    // The toolbar holds the popover; selectionchange may not have shown it
    // yet when the keys come fast.
    this.#ed.track()
    this.linking = s
    flushSync()
    // Opened a frame later, once the toolbar holding it is in the top
    // layer; opened at once, the browser closes it again.
    requestAnimationFrame(() => {
      const trigger = this.#ed.root?.querySelector<HTMLElement>('[data-link]')?.closest('button')
      if (trigger && !this.#ed.root?.querySelector('[data-href]')?.closest('[popover]')?.matches(':popover-open')) {
        trigger.click()
      }
      this.#ed.root?.querySelector<HTMLInputElement>('[data-href] input')?.select()
    })
  }

  // The address typed: the link goes on the held selection; an empty one
  // takes the link off.
  setLink(): void {
    const s = this.linking
    this.linking = null
    const pop = this.#ed.root?.querySelector('[data-href]')?.closest<HTMLElement>('[popover]')
    if (pop?.matches(':popover-open')) {
      pop.hidePopover()
    }
    if (!s) {
      return
    }
    const href = this.href.trim()
    const t = text(this.#ed.doc, s.id)
    if (!href || href === 'https://') {
      this.#ed.apply(() => {
        t.unmark({ start: s.start, end: s.end }, 'link')
        return { id: s.id, anchor: s.anchor, focus: s.focus }
      })
      return
    }
    this.#ed.apply(() => {
      t.mark({ start: s.start, end: s.end }, 'link', href)
      return { id: s.id, anchor: s.anchor, focus: s.focus }
    })
  }
}
