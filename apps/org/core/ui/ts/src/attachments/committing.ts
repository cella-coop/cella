import type { Attachment } from 'svelte/attachments'

// A field whose edit is committed as it is made, as a setting's is.
// Attached to what holds the field: a pick, from a select, a checkbox, a
// radio or a calendar, commits on its change; a typed value commits when
// focus leaves what holds it, or on Enter (Ctrl or Cmd with Enter in a
// text area, where Enter breaks the line); Escape takes a typed edit back.
export interface Committing {
  commit: () => void
  revert: () => void
}

const typed = (t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement =>
  t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'date', 'file'].includes(t.type))

export const committing =
  (o: Committing): Attachment<HTMLElement> =>
  (node) => {
    const change = (e: Event) => {
      if (!typed(e.target)) {
        o.commit()
      }
    }
    const focusout = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && node.contains(e.relatedTarget))) {
        o.commit()
      }
    }
    const keydown = (e: KeyboardEvent) => {
      if (!typed(e.target) || e.isComposing) {
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        o.revert()
      } else if (e.key === 'Enter' && (!(e.target instanceof HTMLTextAreaElement) || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        o.commit()
      }
    }
    node.addEventListener('change', change)
    node.addEventListener('focusout', focusout)
    node.addEventListener('keydown', keydown)
    return () => {
      node.removeEventListener('change', change)
      node.removeEventListener('focusout', focusout)
      node.removeEventListener('keydown', keydown)
    }
  }
