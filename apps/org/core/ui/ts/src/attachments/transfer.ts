import type { Attachment } from 'svelte/attachments'
import type { DragState } from '../hooks/DragState.svelte.ts'

// Lists whose items move between them, as a board's cards between its
// columns. Attached to the container of the lists; each list carries
// `data-drop-list` (its name), each item `data-drag-item` (the group),
// `data-drag-id` and `data-drag-from` (its list), and its handle
// `data-drag-handle`, a button or the item's own link. Only lists that
// `takes` the item light up and accept it. The pointer lifts past a few
// pixels, floats a preview and drops on release; Escape cancels. On a
// focused handle the keyboard lifts with Space (or Enter on a button),
// chooses a list with the arrow keys, drops with Space or Enter and
// cancels with Escape, each step announced. `ondrop` hears where it went.
export interface Transferable {
  group: string
  lists: () => string[]
  takes: (id: string, from: string, to: string) => boolean
  label: (id: string) => string
  ondrop: (id: string, from: string, to: string) => void
}

const threshold = 4

export const transfer =
  (drag: DragState, o: Transferable): Attachment<HTMLElement> =>
  (node) => {
    const live = document.createElement('div')
    live.className = 'visually-hidden'
    live.setAttribute('aria-live', 'assertive')
    document.body.append(live)
    const say = () => {
      live.textContent = drag.announcement
    }

    const itemOf = (el: Element | null) => el?.closest<HTMLElement>(`[data-drag-item="${o.group}"]`) ?? null
    let pending: { id: string; from: string; item: HTMLElement; x: number; y: number; rect: DOMRect } | null = null
    let preview: HTMLElement | null = null

    function listAt(x: number, y: number): string | null {
      for (const el of node.querySelectorAll<HTMLElement>('[data-drop-list]')) {
        const r = el.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return el.dataset.dropList ?? null
        }
      }
      return null
    }

    function finish() {
      preview?.remove()
      preview = null
      pending?.item.removeAttribute('data-dragging')
      pending = null
      window.removeEventListener('pointermove', onpointermove)
      window.removeEventListener('pointerup', onpointerup)
      window.removeEventListener('pointercancel', onpointercancel)
    }

    const swallow = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // A handle that is a link, or holds one or an image, would start the
    // browser's own drag, which cancels the pointer's and snaps the item
    // back; the pointer moves it instead.
    function unnative(e: DragEvent) {
      const t = e.target as Element
      if (t.closest?.('[data-drag-handle]') && node.contains(t)) {
        e.preventDefault()
      }
    }

    function onpointerdown(e: PointerEvent) {
      const handle = (e.target as Element).closest('[data-drag-handle]')
      const item = itemOf(handle)
      if (!handle || !item || !node.contains(item) || e.button !== 0 || drag.carry.group) {
        return
      }
      pending = { id: item.dataset.dragId ?? '', from: item.dataset.dragFrom ?? '', item, x: e.clientX, y: e.clientY, rect: item.getBoundingClientRect() }
      window.addEventListener('pointermove', onpointermove)
      window.addEventListener('pointerup', onpointerup)
      window.addEventListener('pointercancel', onpointercancel)
    }

    function onpointermove(e: PointerEvent) {
      if (!pending) {
        return
      }
      if (!preview) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < threshold) {
          return
        }
        drag.lift(o.group, pending.id, pending.from, 'pointer', o.label(pending.id))
        preview = pending.item.cloneNode(true) as HTMLElement
        preview.removeAttribute('data-drag-item')
        preview.classList.add('drag-preview')
        preview.setAttribute('aria-hidden', 'true')
        Object.assign(preview.style, {
          left: `${pending.rect.left}px`,
          top: `${pending.rect.top}px`,
          width: `${pending.rect.width}px`,
          height: `${pending.rect.height}px`,
        })
        document.body.append(preview)
        pending.item.setAttribute('data-dragging', '')
      }
      e.preventDefault()
      preview.style.transform = `translate(${e.clientX - pending.x}px, ${e.clientY - pending.y}px)`
      const at = listAt(e.clientX, e.clientY)
      drag.aim(at && at !== pending.from && o.takes(pending.id, pending.from, at) ? at : null)
    }

    function onpointerup() {
      if (preview) {
        const moved = drag.land()
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
        finish()
        if (moved) {
          o.ondrop(moved.id, moved.from, moved.to)
        }
      } else {
        finish()
      }
    }

    function onpointercancel() {
      if (preview) {
        drag.putBack()
      }
      finish()
    }

    function onkeydown(e: KeyboardEvent) {
      const handle = (e.target as Element).closest('[data-drag-handle]')
      const item = itemOf(handle)
      if (!handle || !item) {
        return
      }
      const id = item.dataset.dragId ?? ''
      const from = item.dataset.dragFrom ?? ''
      const mine = drag.carry.group === o.group && drag.carry.mode === 'keyboard'
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!mine) {
        if (e.key === ' ' || (e.key === 'Enter' && !handle.matches('a[href]'))) {
          handled()
          drag.lift(o.group, id, from, 'keyboard', o.label(id))
          say()
        }
        return
      }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
        handled()
        drag.next(o.lists(), (l) => o.takes(id, from, l), -1)
        say()
      } else if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
        handled()
        drag.next(o.lists(), (l) => o.takes(id, from, l), 1)
        say()
      } else if (e.key === ' ' || e.key === 'Enter') {
        handled()
        const moved = drag.land()
        say()
        if (moved) {
          o.ondrop(moved.id, moved.from, moved.to)
        }
      } else if (e.key === 'Escape') {
        handled()
        drag.putBack()
        say()
      }
    }

    function onwindowkey(e: KeyboardEvent) {
      if (e.key === 'Escape' && preview) {
        e.preventDefault()
        drag.putBack()
        finish()
      }
    }

    function onfocusout(e: FocusEvent) {
      if (drag.carry.group === o.group && drag.carry.mode === 'keyboard' && !node.contains(e.relatedTarget as Node | null)) {
        drag.putBack()
        say()
      }
    }

    node.addEventListener('pointerdown', onpointerdown)
    node.addEventListener('dragstart', unnative)
    node.addEventListener('keydown', onkeydown)
    node.addEventListener('focusout', onfocusout)
    window.addEventListener('keydown', onwindowkey, { capture: true })
    return () => {
      finish()
      node.removeEventListener('pointerdown', onpointerdown)
      node.removeEventListener('dragstart', unnative)
      node.removeEventListener('keydown', onkeydown)
      node.removeEventListener('focusout', onfocusout)
      window.removeEventListener('keydown', onwindowkey, { capture: true })
      live.remove()
    }
  }
