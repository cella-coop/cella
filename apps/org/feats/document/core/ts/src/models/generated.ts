import type { Fragment } from './edits.ts'

// A policy as a generated document reads it: its kind, and its legal
// wording as it reads.
export interface Reading {
  kind: string
  sentence: string
}

// A default of the circle's legal form that it left, or never took, as a
// generated document reads it: its form in words, its sentence as it
// reads, and the motion's action that left it, if one did.
export interface Departure {
  // The default's id, its form's and its own: `scop-sarl-fr:ordinary`.
  id: string
  form: string
  sentence: string
  leftBy: string | null
}

// How a departure reads, one line: the default, and the action that left
// it or that the circle never took it.
export function departed(d: Departure): string {
  return d.leftBy
    ? `Leaves the ${d.form} default, by ${d.leftBy}: ${d.sentence}.`
    : `Never took the ${d.form} default: ${d.sentence}.`
}

// The blocks a generated document reads as: its template's, each
// `policies` embed replaced by one numbered block per policy of the kind
// its ref names, or of every kind when it names none, in the order given,
// its sentence as it reads; each `departures` embed by one block per
// default of the form its ref names that the circle left or never took,
// or by one saying it left none. The template's nesting is kept.
export function fill(template: Fragment[], policies: Reading[], departures: Departure[] = []): Fragment[] {
  return template.flatMap((f): Fragment[] => {
    if (f.type === 'embed' && f.embed === 'policies') {
      return policies.filter((p) => !f.ref || p.kind === f.ref).map((p) => ({ type: 'numbered', runs: [{ text: p.sentence }], children: [] }))
    }
    if (f.type === 'embed' && f.embed === 'departures') {
      const left = departures.filter((d) => d.id.startsWith(`${f.ref}:`))
      return left.length
        ? left.map((d) => ({ type: 'bullet', runs: [{ text: departed(d) }], children: [] }))
        : [{ type: 'paragraph', runs: [{ text: 'These statutes leave none of their legal form\'s defaults.' }], children: [] }]
    }
    return [{ ...f, children: fill(f.children ?? [], policies, departures) }]
  })
}
