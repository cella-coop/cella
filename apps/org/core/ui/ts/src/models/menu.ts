import type { Component } from 'svelte'
import { edge, moved, typedTo, type Option } from './select.ts'

// A context menu's entries as plain data, so a menu is built from what its
// target offers, as a record's from its writes: each item an icon, a
// label, a shortcut's hint and what choosing it does, or a submenu of
// items of its own; a rule between runs of them. Drawn by `ContextMenu`.

export interface Item {
  label: string
  icon?: Component<any>
  // The shortcut that does the same where the target has the focus, a
  // hint only: the menu reads no key of it.
  kbd?: string
  // What choosing it does; the menu closes first, and the focus is back
  // on its target, so what it does may move it on.
  onselect?: () => void
  // A write that cannot be undone, as a deletion: drawn in the negative
  // ink.
  danger?: boolean
  // Why it cannot be chosen, as a write the reader holds no power for:
  // shown, reachable by the keyboard so the reason is read, never chosen.
  disabled?: string
  // A choice among its siblings, the one now held marked, as an icon a
  // view wears (`menuitemradio`).
  checked?: boolean
  // A submenu, opened beside it, its item drawn with a chevron.
  items?: Entry[]
}

export interface Rule {
  rule: true
}

export type Entry = Item | Rule

export const rule: Rule = { rule: true }

export const ruled = (e: Entry | undefined): e is Rule => !!e && 'rule' in e

// The entries as a select's options, so the keyboard's moves are the
// select's: a rule is passed over, a disabled item is not, since its
// reason is read where the keyboard lands on it.
const options = (entries: Entry[]): Option[] => entries.map((e, i) => ({ value: String(i), label: ruled(e) ? '' : e.label, disabled: ruled(e) }))

// Where a move by `by` from `at` lands, wrapping past either end, as a
// menu's arrows do.
export function step(entries: Entry[], at: number, by: number): number {
  const os = options(entries)
  if (at < 0) {
    return edge(os, by > 0 ? 'first' : 'last')
  }
  const to = moved(os, at, by)
  return to === at ? edge(os, by > 0 ? 'first' : 'last') : to
}

export const end = (entries: Entry[], which: 'first' | 'last') => edge(options(entries), which)

// The item typing `typed` reaches, the next whose label starts with it.
export const typed = (entries: Entry[], at: number, run: string) => typedTo(options(entries), at, run)

// Whether an entry is an item that does something when chosen.
export const choosable = (e: Entry | undefined): e is Item => !!e && !ruled(e) && !e.disabled

// Where a menu of size `w` by `h` goes, kept inside a window of `vw` by
// `vh`: at `x`, `y`, or, where it would pass the right or the bottom
// edge, flipped to end at `before` or `above`, as a submenu flips to its
// parent's other side, and held a margin inside whatever it does.
export function fit(at: { x: number; y: number; before?: number; above?: number }, w: number, h: number, vw: number, vh: number, margin = 8): { left: number; top: number } {
  const flip = (start: number, size: number, room: number, back?: number) => {
    if (start + size <= room - margin) {
      return Math.max(margin, start)
    }
    if (back !== undefined && back - size >= margin) {
      return back - size
    }
    return Math.max(margin, room - margin - size)
  }
  return { left: flip(at.x, w, vw, at.before), top: flip(at.y, h, vh, at.above) }
}
