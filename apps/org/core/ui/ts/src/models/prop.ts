import type { Component } from 'svelte'
import type { Kind, Tone } from './view.ts'
import { show } from './format.ts'
import { inkOf } from './ink.ts'
import { stage, type Lifecycle, type Stage } from './status.ts'

// What a property wears before its text, in every place it is drawn:
// one table of kind to look, so a cell, a card, a drawer's row and the
// options of a popover never disagree.

// The sizes a property is drawn at: `inline` in running text, `cell` in
// a table, a list or a group's header, `card` as a quiet chip on a card,
// `drawer` as a row of the drawer.
export type Size = 'inline' | 'cell' | 'card' | 'drawer'

// What the shell knows to draw a reference by.
export interface Known {
  icon(collection: string | undefined, id?: string): Component<any> | undefined
  name(address: string): string | undefined
  circle(id: string): string | undefined
}

// A priority's bars, one to three, `urgent` its own alert and anything
// else none, a dashed line.
export const bars: Record<string, number | 'urgent'> = { low: 1, normal: 2, high: 3, urgent: 'urgent' }

export interface Look {
  text: string
  // The words drawn: a person's or a circle's name where the value is an
  // address or an id.
  shown: string
  empty: boolean
  // Whether it names a record: a circle, or a row of the collection its
  // column says. `Value` draws one as a `Chip`; a person keeps its avatar.
  record: boolean
  // A record's or circle's icon, in its own ink.
  icon?: Component<any>
  ink?: number
  // What is drawn before the text.
  lead: 'avatar' | 'icon' | 'dot' | 'stage' | 'bars' | 'check' | 'none'
  level?: number | 'urgent'
  // A status's place in its lifecycle: its category's glyph and tone.
  stage?: Stage
}

/** How a value looks as a kind: its text, its lead and its ink. */
export function look(shell: Known, value: unknown, kind: Kind = 'text', tone?: Tone, record?: string, states?: Lifecycle): Look {
  const text = show(value, kind)
  const empty = text === '—'
  // A status is drawn by its lifecycle; a value it does not list, as a
  // badge.
  const at = kind === 'status' && states && !empty ? stage(states, value) : undefined
  if (at) {
    return { text, shown: at.label, empty, record: false, lead: 'stage', stage: at }
  }
  const shown = kind === 'circle' ? (shell.circle(text) ?? text) : kind === 'person' ? (shell.name(text) ?? text) : text
  // A circle is always a circle's; any other value is a record where its
  // column says of which collection.
  const of = kind === 'circle' ? 'circles' : kind === 'person' ? undefined : record
  const base = { text, shown, empty, record: of !== undefined && !empty }
  if (empty) {
    return { ...base, lead: kind === 'priority' ? 'bars' : 'none' }
  }
  if (kind === 'priority') {
    return { ...base, lead: 'bars', level: bars[text.toLowerCase()] }
  }
  if (kind === 'boolean') {
    return { ...base, lead: value === true || value === 'true' ? 'check' : 'none' }
  }
  if (kind === 'person') {
    return { ...base, lead: 'avatar' }
  }
  const icon = of ? shell.icon(of, kind === 'circle' ? text : undefined) : undefined
  if (icon) {
    return { ...base, lead: 'icon', icon, ink: inkOf(shown) }
  }
  if (kind === 'badge' || kind === 'status') {
    // A tone with a colour of its own keeps it; the rest wear an ink
    // seeded by their value.
    return { ...base, lead: 'dot', ink: !tone || tone === 'neutral' || tone === 'accent' ? inkOf(text) : undefined }
  }
  return { ...base, lead: 'none' }
}
