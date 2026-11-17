import type { Attachment } from 'svelte/attachments'

// A tooltip in the top layer, kept inside the window: attached to the
// popover that sits right after the button it explains, shown as the
// pointer rests on the button or the keyboard focuses it, hidden by
// Escape, a pointer leaving or the button losing focus. The app's one way
// to put a sentence behind an icon, never a native `title`. Opens below
// its button, flipped above where there is no room left under it, as a
// trigger near the viewport's own foot (a demo's banner) needs.
export const tip: Attachment<HTMLElement> = (el) => {
  const button = el.previousElementSibling as HTMLElement
  const margin = 8
  const show = () => {
    if (!el.matches(':popover-open')) {
      el.showPopover()
    }
    const r = button.getBoundingClientRect()
    const w = el.offsetWidth
    const h = el.offsetHeight
    const window = el.ownerDocument.defaultView ?? globalThis
    el.style.left = `${Math.max(margin, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - margin - w))}px`
    el.style.top = r.bottom + 6 + h <= window.innerHeight - margin ? `${r.bottom + 6}px` : `${Math.max(margin, r.top - 6 - h)}px`
  }
  const hide = () => {
    if (el.matches(':popover-open')) {
      el.hidePopover()
    }
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && el.matches(':popover-open')) {
      e.stopPropagation()
      hide()
    }
  }
  for (const [type, fn] of [['pointerenter', show], ['focus', show], ['pointerleave', hide], ['blur', hide]] as const) {
    button.addEventListener(type, fn)
  }
  button.addEventListener('keydown', key)
  return () => {
    hide()
    for (const [type, fn] of [['pointerenter', show], ['focus', show], ['pointerleave', hide], ['blur', hide]] as const) {
      button.removeEventListener(type, fn)
    }
    button.removeEventListener('keydown', key)
  }
}
