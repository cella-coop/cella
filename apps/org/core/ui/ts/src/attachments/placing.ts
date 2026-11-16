import type { Attachment } from 'svelte/attachments'
import type { DragState } from '../hooks/DragState.svelte.ts'

// A list whose items land on places the list names, not only between its
// items: an arrangement's choices, which land in an accordion or out of
// one, at the top level, or among those not shown, and its accordions.
// Attached to the list. Each item carries `data-drag-item` (the list's
// name) and `data-drag-key`, its handle `data-drag-handle`. While an item
// is lifted the list draws its places, each `data-drop-place` (its
// index), a line where the item would land, indented as deep as it would
// sit, or `data-drop-zone` (its index), an area that takes it anywhere
// inside, such as the choices not shown. The pointer lifts past a few
// pixels, floats a preview, and aims at the zone under it, or else at the
// nearest line, the one as deep as the preview's left edge where two lie
// together, as the end of an accordion and the top level after it do;
// release drops, Escape cancels. On a focused handle the keyboard lifts
// with Space (or Enter), steps through the places with the arrow keys,
// drops with Space or Enter and cancels with Escape, each step announced
// in the list's own words (`describe`). `onplace` hears the drop.
export interface Placing {
  list: string
  // The item lifted: how many places it may land on, the one it is at,
  // and its name.
  lift: (key: string) => { from: number; length: number; label: string }
  describe: (to: number) => string
  onplace: (key: string, to: number) => void
}

const threshold = 4

export const placing =
  (drag: DragState, o: Placing): Attachment<HTMLElement> =>
  (node) => {
    const live = document.createElement('div')
    live.className = 'visually-hidden'
    live.setAttribute('aria-live', 'assertive')
    document.body.append(live)
    const say = (text: string) => {
      drag.announcement = text
      live.textContent = text
    }

    const itemOf = (el: Element | null) => el?.closest<HTMLElement>(`[data-drag-item="${o.list}"]`) ?? null
    let pending: { key: string; item: HTMLElement; x: number; y: number; rect: DOMRect } | null = null
    let preview: HTMLElement | null = null

    // The place the pointer aims at: the zone under it, or the nearest
    // line, the one nearest the preview's left edge among lines together.
    function aimed(x: number, y: number, left: number): number {
      for (const z of node.querySelectorAll<HTMLElement>('[data-drop-zone]')) {
        const r = z.getBoundingClientRect()
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return Number(z.dataset.dropZone)
        }
      }
      const lines = [...node.querySelectorAll<HTMLElement>('[data-drop-place]')].map((el) => {
        const r = el.getBoundingClientRect()
        return { at: Number(el.dataset.dropPlace), dy: Math.abs(r.top + r.height / 2 - y), left: r.left }
      })
      if (!lines.length) {
        return drag.drag.to
      }
      const near = Math.min(...lines.map((l) => l.dy))
      const together = lines.filter((l) => l.dy <= near + 2)
      together.sort((a, b) => Math.abs(a.left - left) - Math.abs(b.left - left))
      return together[0]!.at
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

    function onpointerdown(e: PointerEvent) {
      const handle = (e.target as Element).closest('[data-drag-handle]')
      const item = itemOf(handle)
      if (!handle || !item || !node.contains(item) || e.button !== 0 || drag.lifted) {
        return
      }
      pending = { key: item.dataset.dragKey ?? '', item, x: e.clientX, y: e.clientY, rect: item.getBoundingClientRect() }
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
        const l = o.lift(pending.key)
        drag.start(o.list, l.from, l.length, 'pointer', l.label)
        drag.key = pending.key
        const copy = pending.item.cloneNode(true) as HTMLElement
        copy.removeAttribute('data-drag-item')
        for (const el of copy.querySelectorAll('[id]')) {
          el.removeAttribute('id')
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
          overflow: 'hidden',
        })
        const host = node.closest<HTMLElement>('[popover], dialog') ?? document.body
        host.append(preview)
        pending.item.setAttribute('data-dragging', '')
      }
      e.preventDefault()
      const dx = e.clientX - pending.x
      preview.style.transform = `translate(${dx}px, ${e.clientY - pending.y}px)`
      drag.over(aimed(e.clientX, e.clientY, pending.rect.left + dx))
    }

    function onpointerup() {
      if (preview && pending) {
        const key = pending.key
        const move = drag.drop()
        drag.key = null
        window.addEventListener('click', swallow, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
        finish()
        if (move) {
          o.onplace(key, move.to)
        }
      } else {
        finish()
      }
    }

    function onpointercancel() {
      if (preview) {
        drag.cancel()
        drag.key = null
      }
      finish()
    }

    function refocus(key: string) {
      const focus = () => node.querySelector<HTMLElement>(`[data-drag-item="${o.list}"][data-drag-key="${CSS.escape(key)}"] [data-drag-handle]`)?.focus()
      requestAnimationFrame(focus)
      setTimeout(focus, 300)
    }

    function onkeydown(e: KeyboardEvent) {
      const handle = (e.target as Element).closest('[data-drag-handle]')
      const item = itemOf(handle)
      if (!handle || !item) {
        return
      }
      const key = item.dataset.dragKey ?? ''
      const mine = drag.drag.list === o.list && drag.drag.mode === 'keyboard' && drag.key === key
      const handled = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      if (!mine) {
        if (e.key === ' ' || e.key === 'Enter') {
          handled()
          const l = o.lift(key)
          drag.start(o.list, l.from, l.length, 'keyboard', l.label)
          drag.key = key
          say(`${l.label} lifted: ${o.describe(l.from)}. The arrow keys move it, Space drops it, Escape cancels.`)
        }
        return
      }
      if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
        handled()
        drag.step(-1)
        say(o.describe(drag.drag.to))
      } else if (['ArrowDown', 'ArrowRight'].includes(e.key)) {
        handled()
        drag.step(1)
        say(o.describe(drag.drag.to))
      } else if (e.key === ' ' || e.key === 'Enter') {
        handled()
        const to = drag.drag.to
        const move = drag.drop()
        drag.key = null
        say(move ? `Dropped: ${o.describe(to)}.` : 'Dropped where it was.')
        if (move) {
          o.onplace(key, move.to)
          refocus(key)
        }
      } else if (e.key === 'Escape') {
        handled()
        drag.cancel()
        drag.key = null
        say('Move cancelled.')
      }
    }

    function onwindowkey(e: KeyboardEvent) {
      if (e.key === 'Escape' && preview) {
        e.preventDefault()
        drag.cancel()
        drag.key = null
        finish()
      }
    }

    // Focus leaving the list puts a keyboard drag down where it began.
    function onfocusout(e: FocusEvent) {
      if (drag.drag.list === o.list && drag.drag.mode === 'keyboard' && !node.contains(e.relatedTarget as Node | null)) {
        drag.cancel()
        drag.key = null
        say('Move cancelled.')
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
