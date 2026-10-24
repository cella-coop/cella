import { extension, findLCA, type Nabu } from '@aionbuilders/nabu'
import type { Cursor } from 'loro-crdt'
import { tick } from 'svelte'
import { canonical, hash } from '../canonical.ts'
import { engine } from '../editor/engine.ts'

type Target = { block: any; from: number; to: number }

// One editor: nabu's engine on its own LoroDoc, the element it renders
// into, its canonical hash, and the few things nabu leaves to the host:
// Cmd-K links, moving blocks from the keyboard, Tab outside lists, and
// keeping the caret still while a remote update lands.
export class EditorState {
  readonly name: string
  readonly engine: Nabu
  root: HTMLElement | null = null
  composing = false
  json = $state.raw('')
  hash = $state('')
  link: { targets: Target[]; href: string } | null = $state(null)

  constructor(name: string, snapshot?: Uint8Array) {
    this.name = name
    this.engine = engine(snapshot, [this.#keys()])
    this.measure()
    this.engine.doc.subscribe(() => queueMicrotask(() => this.measure()))
  }

  measure() {
    this.json = canonical(this.engine.doc)
    this.hash = hash(this.json)
  }

  #keys() {
    return extension(`keys`, {
      hooks: {
        onKeyDown: (nabu: Nabu, e: KeyboardEvent) => {
          const mod = e.ctrlKey || e.metaKey
          if (mod && !e.shiftKey && e.key.toLowerCase() === 'k') {
            e.preventDefault()
            this.startLink()
            return nabu.BREAK
          }
          if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault()
            this.move(e.key === 'ArrowUp' ? -1 : 1)
            return nabu.BREAK
          }
          // nabu nests list items only; elsewhere Tab would leave the editor.
          if (e.key === 'Tab' && nabu.selection.anchorBlock?.type !== 'list-item') {
            e.preventDefault()
            return nabu.BREAK
          }
        },
      } as any,
    })
  }

  // The selected text ranges, as nabu's own mark commands collect them.
  #targets(): Target[] {
    const out: Target[] = []
    for (const [, block] of this.engine.blocks) {
      const sel = (block as any).behaviors?.get('text')?.selection
      if (block.selected && sel && !sel.isCollapsed && this.root?.contains(block.element)) {
        out.push({ block, from: sel.from, to: sel.to })
      }
    }
    return out
  }

  startLink() {
    const targets = this.#targets()
    if (targets.length) {
      this.link = { targets, href: '' }
    }
  }

  applyLink(href: string) {
    const link = this.link
    this.link = null
    if (!link || !href) {
      return
    }
    for (const t of link.targets) {
      t.block.behaviors.get('text').applyMark('link', href, { from: t.from, to: t.to, isCollapsed: false })
    }
    this.engine.commit()
  }

  // Move the blocks the selection spans one place up or down among their
  // siblings.
  move(dir: -1 | 1) {
    const sel = this.engine.selection
    const start = sel.startBlock as any
    const end = (sel.endBlock ?? start) as any
    if (!start) {
      return
    }
    const lca = start === end ? start.parent : findLCA(start, end)
    const siblings: any[] = lca ? lca.children : this.engine.children
    const top = (b: any) => {
      while (b && b.parent !== lca) {
        b = b.parent
      }
      return b
    }
    const first = top(start)
    const last = top(end)
    const i = siblings.indexOf(first)
    const j = siblings.indexOf(last)
    if (i < 0 || j < 0) {
      return
    }
    if (dir < 0 && i > 0) {
      siblings[i - 1].node.moveAfter(last.node)
    } else if (dir > 0 && j < siblings.length - 1) {
      siblings[j + 1].node.moveBefore(first.node)
    } else {
      return
    }
    const offset = start.behaviors?.get('text')?.selection?.from ?? 0
    this.engine.commit().then(() => this.engine.selection.setCursor(start, offset))
  }

  // Pin the caret to Loro cursors before a remote update, and put it back
  // where those cursors resolve after the editor re-renders. nabu re-renders
  // a block's text nodes on every change, which drops the DOM caret to the
  // start of the node.
  pin(): (() => Promise<void>) | null {
    const sel = this.engine.selection
    const block = sel.anchorBlock as any
    if (!block || !this.root || !this.root.contains(document.activeElement)) {
      return null
    }
    const text = block.behaviors?.get('text')
    const range = text?.selection
    if (!text || !range) {
      return null
    }
    const id = block.id
    const a: Cursor | undefined = text.container.getCursor(range.from)
    const b: Cursor | undefined = text.container.getCursor(range.to)
    return async () => {
      await Promise.resolve()
      await tick()
      const fresh = this.engine.blocks.get(id) as any
      if (!fresh?.element || !a || !b) {
        return
      }
      const from = this.engine.doc.getCursorPos(a)?.offset ?? range.from
      const to = this.engine.doc.getCursorPos(b)?.offset ?? range.to
      const p = fresh.getDOMPoint(from)
      const q = fresh.getDOMPoint(to)
      if (p && q) {
        this.engine.selection.setBaseAndExtent(p.node, p.offset, q.node, q.offset)
      }
    }
  }
}
