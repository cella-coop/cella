import type { Attachment } from 'svelte/attachments'

// Whether a key press belongs to a field being typed in, which single-key
// shortcuts leave alone.
export function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) {
    return false
  }
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

// Whether the key press lands on a control that acts on it itself, as a
// button or a link does on Enter; a page's shortcut for the same key
// would act twice.
export function control(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return typing(e) || !!t?.closest?.('a[href], button, summary, [role="option"]')
}

// Keeps the keyboard's row in view: scrolls the element to the nearest
// edge whenever it becomes the active one.
export const nearest =
  (active: boolean): Attachment<HTMLElement> =>
  (node) => {
    if (active) {
      node.scrollIntoView({ block: 'nearest' })
    }
  }

// Where the keyboard's row goes from `at`, `by` rows on, over the `drawn`
// rows with `left` more the server holds: one past the last drawn row is
// the next page's first, which the move asks for, and no further.
export const step = (at: number, by: number, drawn: number, left: number): number =>
  Math.max(0, Math.min(at + by, drawn - 1 + (left > 0 ? 1 : 0)))

// The one row in the tab order, where the keyboard roves the rows: its
// row, the first before it is on one, the last drawn while the next page
// it moved to is asked for.
export const stop = (at: number, drawn: number): number => Math.max(0, Math.min(at, drawn - 1))

// The keyboard's row takes the focus: scrolled to the nearest edge and
// focused whenever it becomes the active one, unless the focus is in it.
export const focused =
  (active: boolean): Attachment<HTMLElement> =>
  (node) => {
    if (active) {
      node.scrollIntoView({ block: 'nearest' })
      if (!node.contains(document.activeElement)) {
        node.focus({ preventScroll: true })
      }
    }
  }

const focusable = 'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'

// A region that scrolls is in the tab order, named `label`, while it
// scrolls and holds nothing the keyboard can reach, so the arrows scroll
// it; otherwise it is left as it was. Read again whenever its size or
// what it holds changes.
export const scroller =
  (label: string): Attachment<HTMLElement> =>
  (node) => {
    const read = () => {
      const scrolls = node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth
      if (scrolls && !node.querySelector(focusable)) {
        node.tabIndex = 0
        node.setAttribute('role', 'region')
        node.setAttribute('aria-label', label)
      } else if (node.hasAttribute('tabindex')) {
        node.removeAttribute('tabindex')
        node.removeAttribute('role')
        node.removeAttribute('aria-label')
      }
    }
    read()
    const sized = new ResizeObserver(read)
    sized.observe(node)
    const changed = new MutationObserver(read)
    changed.observe(node, { childList: true, subtree: true })
    return () => {
      sized.disconnect()
      changed.disconnect()
    }
  }
