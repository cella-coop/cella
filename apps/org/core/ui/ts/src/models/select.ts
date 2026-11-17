import type { Component } from 'svelte'
import type { Tone } from './view.ts'

// A select's options as plain data, and the moves its keyboard makes over
// them: the next option the arrows, Home and End reach, past disabled
// ones, and the one typing its first letters reaches. Drawn by `Select`.

export interface Option {
  value: string
  label: string
  // A Phosphor icon drawn before the label, in the option and the trigger.
  icon?: Component<any>
  // A tone's dot drawn before the label where it has no icon, as a badge's.
  tone?: Tone
  // A person's name, drawn as their avatar before the label.
  who?: string
  // Chosen by nobody: shown, never picked.
  disabled?: boolean
  // What the view takes when nothing is chosen, marked subtly in the list.
  default?: boolean
  // The heading the option sits under; consecutive options sharing one
  // form a group.
  group?: string
}

export interface Group {
  label: string | null
  options: { option: Option; at: number }[]
}

// The options in runs under their headings, each with its index in the
// flat list, which the keyboard moves over.
export function grouped(options: Option[]): Group[] {
  const out: Group[] = []
  options.forEach((option, at) => {
    const label = option.group ?? null
    const last = out.at(-1)
    if (last && last.label === label) {
      last.options.push({ option, at })
    } else {
      out.push({ label, options: [{ option, at }] })
    }
  })
  return out
}

const open = (o: Option | undefined) => !!o && !o.disabled

// The option a move from `at` reaches by `by`, past disabled ones, held at
// the ends; from nothing, the first one down or the last one up.
export function moved(options: Option[], at: number, by: number): number {
  if (!options.some(open)) {
    return -1
  }
  let i = at < 0 ? (by > 0 ? -1 : options.length) : at
  const step = by > 0 ? 1 : -1
  let left = Math.abs(by)
  let last = at
  while (left > 0) {
    i += step
    if (i < 0 || i >= options.length) {
      break
    }
    if (open(options[i])) {
      last = i
      left--
    }
  }
  return last >= 0 && open(options[last]) ? last : edge(options, step > 0 ? 'last' : 'first')
}

// The first or last option that may be chosen.
export function edge(options: Option[], which: 'first' | 'last'): number {
  const order = options.map((_, i) => i)
  const found = (which === 'first' ? order : order.reverse()).find((i) => open(options[i]))
  return found ?? -1
}

// The option typing `typed` reaches: the next after `at` whose label
// starts with it, wrapping; a letter typed again and again cycles through
// the options it starts.
export function typedTo(options: Option[], at: number, typed: string): number {
  const q = typed.toLowerCase()
  const same = q.length > 1 && [...q].every((c) => c === q[0])
  const needle = same ? q[0] : q
  const n = options.length
  // A longer prefix keeps the option it is on where it still matches.
  const from = same || q.length === 1 ? at + 1 : Math.max(at, 0)
  for (let k = 0; k < n; k++) {
    const i = (((from + k) % n) + n) % n
    if (open(options[i]) && options[i].label.toLowerCase().startsWith(needle)) {
      return i
    }
  }
  return at
}

// The index of a value among the options, or -1.
export const indexOf = (options: Option[], value: string | null | undefined) => options.findIndex((o) => o.value === value)
