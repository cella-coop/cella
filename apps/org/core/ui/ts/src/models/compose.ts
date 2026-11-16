import type { Decider } from './settings.ts'

// Something new composed in a dialog and proposed as one motion: the
// fields the reader types, each an argument of the motion's one action,
// and what the motion carries as it is.

// A field of what is composed: the argument it fills, its label, its
// type and, for a text area, its rows. None is a key the write can take
// itself, as a role's id is taken from its name.
export interface Composed {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'url'
  rows?: number
  wide?: boolean
}

// The motion composed: the circle that decides it, its kind, the fields
// typed, the arguments it carries as they are, and its title, from the
// values typed.
export interface Composing {
  decider: Decider
  kind: string
  fields: Composed[]
  args?: Record<string, string>
  says: (values: Record<string, string>) => string
}

// Each field's value as typed, empty where it was not.
export function valued(fields: Composed[], typed: Record<string, string>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, typed[f.name] ?? '']))
}

// What the motions' New form posts for it: its circle, title and
// deadline, its one action's kind and arguments, each named
// `arg.<name>`, and no reasons.
export function posted(c: Composing, values: Record<string, string>): [string, string][] {
  return [
    ['title', c.says(values)],
    ['circle', c.decider.circle],
    ['deadline', c.decider.deadline],
    ['kind', c.kind],
    ...Object.entries({ ...c.args, ...values }).map(([k, v]): [string, string] => [`arg.${k}`, v]),
    ['body', ''],
  ]
}
