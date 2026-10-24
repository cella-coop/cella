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
