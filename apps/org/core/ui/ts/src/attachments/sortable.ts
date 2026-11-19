import type { Attachment } from 'svelte/attachments'
import type { DragState } from '../hooks/DragState.svelte.ts'

// A list whose items reorder by dragging. Attached to the list; its items
// carry `data-drag-item` (the list's name) and `data-drag-index`, and each
// item's handle `data-drag-handle`, a labelled button, or the item's own
// link. The pointer (a mouse, a finger or a pen) lifts an item once it
// moves past a few pixels, drags a preview of it, scrolls the list's
// scroller near its edges, and drops on release; Escape cancels. The
// keyboard, on a focused handle, lifts with Space (or Enter on a button),
// moves with the arrow keys, drops with Space or Enter and cancels with
// Escape, each step announced. `onmove` hears the drop: the item's index
// before and after.
export interface Sortable {
  list: string
  axis?: 'x' | 'y'
  label: (i: number) => string
  onmove: (from: number, to: number) => void
  // false where the handle's own keys mean something else, as a table
  // header's Enter orders by its column: its list moves by keys of its own.
  keys?: boolean
}

const threshold = 4
const edge = 40

export const sortable =
  (drag: DragState, o: Sortable): Attachment<HTMLElement> =>
  (node) => {
    const axis = o.axis ?? 'y'
    const live = document.createElement('div')
    live.className = 'visually-hidden'
    live.setAttribute('aria-live', 'assertive')
    document.body.append(live)
    const say = () => {
      live.textContent = drag.announcement
    }

    const items = () => [...node.querySelectorAll<HTMLElement>(`[data-drag-item="${o.list}"]`)]
    const indexOf = (el: Element | null) => Number((el?.closest('[data-drag-item]') as HTMLElement | null)?.dataset.dragIndex ?? -1)
    const ours = (el: Element | null) => (el?.closest('[data-drag-item]') as HTMLElement | null)?.dataset.dragItem === o.list

    let pending: { index: number; item: HTMLElement; x: number; y: number; rect: DOMRect } | null = null
    let preview: HTMLElement | null = null
    let pointer = { x: 0, y: 0 }
    let frame = 0

    const scroller = (): HTMLElement | null => {
      for (let el = node.parentElement; el; el = el.parentElement) {
        const style = getComputedStyle(el)
        if (/(auto|scroll)/.test(axis === 'y' ? style.overflowY : style.overflowX)) {
          return el
        }
      }
      return null
    }

    // The index the item would take: how many other items lie before the
    // pointer.
    function target() {
      const at = axis === 'y' ? pointer.y : pointer.x
      return items().filter((it) => {
        if (indexOf(it) === drag.drag.from) {
          return false
        }
        const r = it.getBoundingClientRect()
        return (axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2) < at
      }).length
    }

    function scroll() {
      const s = scroller()
      if (s && drag.lifted) {
        const r = s.getBoundingClientRect()
        const at = axis === 'y' ? pointer.y : pointer.x
        const [start, end] = axis === 'y' ? [r.top, r.bottom] : [r.left, r.right]
        const by = at < start + edge ? -8 : at > end - edge ? 8 : 0
        if (by) {
          s.scrollBy(axis === 'y' ? { top: by } : { left: by })
          drag.over(target())
        }
      }
      frame = requestAnimationFrame(scroll)
    }

    function finish() {
      cancelAnimationFrame(frame)
      preview?.remove()
      preview = null
      pending?.item.removeAttribute('data-dragging')
      pending = null
      window.removeEventListener('pointermove', onpointermove)
      window.removeEventListener('pointerup', onpointerup)
      window.removeEventListener('pointercancel', onpointercancel)
    }

    // A click ending a drag would follow the dragged link.
    const swallow = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    function onpointerdown(e: PointerEvent) {
      const handle = (e.target as Element).closest('[data-drag-handle]')
      if (!handle || !node.contains(handle) || !ours(handle) || e.button !== 0 || drag.lifted) {
        return
      }
      const item = handle.closest('[data-drag-item]') as HTMLElement
      pending = { index: indexOf(item), item, x: e.clientX, y: e.clientY, rect: item.getBoundingClientRect() }
      window.addEventListener('pointermove', onpointermove)
      window.addEventListener('pointerup', onpointerup)
      window.addEventListener('pointercancel', onpointercancel)
    }

    function onpointermove(e: PointerEvent) {
      if (!pending) {
        return
      }
      pointer = { x: e.clientX, y: e.clientY }
      if (!preview) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < threshold) {
          return
        }
        drag.start(o.list, pending.index, items().length, 'pointer', o.label(pending.index))
        // The item's copy, inside an empty copy of the list, its tag and
        // classes, so the list's own styles, which reach its items from
        // above, draw the preview as they draw the item.
        const copy = pending.item.cloneNode(true) as HTMLElement
        copy.removeAttribute('data-drag-item')
        copy.removeAttribute('data-drop')
        for (const el of copy.querySelectorAll('[contenteditable], [id], [data-block]')) {
          el.removeAttribute('contenteditable')
          el.removeAttribute('id')
          el.removeAttribute('data-block')
        }
        preview = document.createElement(node.tagName)
        preview.className = node.className
        preview.classList.add('drag-preview')
        preview.setAttribute('aria-hidden', 'true')
        preview.append(copy)
        Object.assign(preview.style, {
          left: `${pending.rect.left}px`,
          top: `${pending.rect.top}px`,
          width: `${pending.rect.width}px`,
          height: `${pending.rect.height}px`,
          padding: '0',
          minHeight: '0',
          maxWidth: 'none',
          overflow: 'hidden',
        })
        // In a popover, the preview joins it in the top layer, above it.
        const host = node.closest<HTMLElement>('[popover]') ?? document.body
        host.append(preview)
        pending.item.setAttribute('data-dragging', '')
        frame = requestAnimationFrame(scroll)
      }
      e.preventDefault()
      preview.style.transform = `translate(${e.clientX - pending.x}px, ${e.clientY - pending.y}px)`
      drag.over(target())
    }

    function onpointerup() {
      if (preview) {
        const move = drag.drop()
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
        finish()
        if (move) {
          o.onmove(move.from, move.to)
        }
      } else {
        finish()
      }
    }

    function onpointercancel() {
      if (preview) {
        drag.cancel()
      }
      finish()
    }

    function refocus(to: number) {
      const focus = () => node.querySelector<HTMLElement>(`[data-drag-item="${o.list}"][data-drag-index="${to}"] [data-drag-handle], [data-drag-item="${o.list}"][data-drag-index="${to}"][data-drag-handle]`)?.focus()
      requestAnimationFrame(focus)
      setTimeout(focus, 300)
    }

    function onkeydown(e: KeyboardEvent) {
      if (o.keys === false) {
        return
      }
      const handle = (e.target as Element).closest('[data-drag-handle]')
      if (!handle || !ours(handle)) {
        return
      }
      const mine = drag.drag.list === o.list && drag.drag.mode === 'keyboard'
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!mine) {
        if (e.key === ' ' || (e.key === 'Enter' && !handle.matches('a[href]'))) {
          handled()
          const i = indexOf(handle)
          drag.start(o.list, i, items().length, 'keyboard', o.label(i))
          say()
        }
        return
      }
      if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
        handled()
        drag.step(-1)
        say()
      } else if (['ArrowDown', 'ArrowRight'].includes(e.key)) {
        handled()
        drag.step(1)
        say()
      } else if (e.key === ' ' || e.key === 'Enter') {
        handled()
        const move = drag.drop()
        say()
        if (move) {
          o.onmove(move.from, move.to)
          refocus(move.to)
        }
      } else if (e.key === 'Escape') {
        handled()
        drag.cancel()
        say()
      }
    }

    function onwindowkey(e: KeyboardEvent) {
      if (e.key === 'Escape' && preview) {
        e.preventDefault()
        drag.cancel()
        finish()
      }
    }

    // Focus leaving the list puts a keyboard drag down where it began.
    function onfocusout(e: FocusEvent) {
      if (drag.drag.list === o.list && drag.drag.mode === 'keyboard' && !node.contains(e.relatedTarget as Node | null)) {
        drag.cancel()
        say()
      }
    }

    node.addEventListener('pointerdown', onpointerdown)
    node.addEventListener('keydown', onkeydown)
    node.addEventListener('focusout', onfocusout)
    window.addEventListener('keydown', onwindowkey, { capture: true })
    return () => {
      finish()
      node.removeEventListener('pointerdown', onpointerdown)
      node.removeEventListener('keydown', onkeydown)
      node.removeEventListener('focusout', onfocusout)
      window.removeEventListener('keydown', onwindowkey, { capture: true })
      live.remove()
    }
  }
