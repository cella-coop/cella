import type { Fragment } from './edits.ts'

// A policy as a generated document reads it: its kind, and its legal
// wording as it reads.
export interface Reading {
  kind: string
  sentence: string
}

// The blocks a generated document reads as: its template's, each
// `policies` embed replaced by one numbered block per policy of the kind
// its ref names, or of every kind when it names none, in the order given,
// its sentence as it reads. The template's nesting is kept.
export function fill(template: Fragment[], policies: Reading[]): Fragment[] {
  return template.flatMap((f): Fragment[] =>
    f.type === 'embed' && f.embed === 'policies'
      ? policies.filter((p) => !f.ref || p.kind === f.ref).map((p) => ({ type: 'numbered', runs: [{ text: p.sentence }], children: [] }))
      : [{ ...f, children: fill(f.children ?? [], policies) }],
  )
}
