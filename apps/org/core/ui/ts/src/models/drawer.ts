import type { Component } from 'svelte'
import type { Prop } from './view.ts'

// The drawer's properties, laid out to be read at a glance, as Linear's
// are: sections, each a quiet heading over rows of one height. Every
// row is bare, an icon and its value, its name only its tooltip and its
// accessible name: the value's own lead says what it is where it has
// one (a state's pill, a priority's bars, a person's avatar, a circle's
// or a record's chip), else the field's own glyph, its slice's or its
// kind's, and a quiet lead word before the value where the value alone
// would not say what it is (`lead`): a day always has one. Two rows
// naming the same record are one, naming both fields, and a phrase that
// only repeats a record's chip is not drawn. A computed figure is no
// property: it is a `Stat` on the overview (`figures`).

export interface Row {
  prop: Prop
  // The field's name, or the names of the fields merged into the row.
  label: string
}

export interface Section {
  name: string
  rows: Row[]
}

// The collection a property's link is a record of, where it is one:
// `/<collection>/<id>`.
export const record = (href: string | undefined): string | undefined => href?.match(/^\/([\w-]+)\/[^/?#]+$/)?.[1]

// The section a property sits in: the one its slice names, else by its
// kind, a day under Dates, the rest under Properties.
export const place = (p: Prop): string => p.group ?? (p.kind === 'date' ? 'Dates' : 'Properties')

// What a row's value is, by which two of them name the same thing; none
// where it names nothing of its own.
export function sort(p: Prop): string | null {
  if (p.people || p.kind === 'person') {
    return 'person'
  }
  if (p.kind === 'circle') {
    return 'circles'
  }
  const of = record(p.href)
  if (of) {
    return of
  }
  if (p.kind === 'badge' || p.kind === 'priority' || p.kind === 'boolean') {
    return p.kind
  }
  if (p.icon || p.glyph) {
    return `own:${p.label}`
  }
  return null
}

// Whether a row's value leads with its own mark, a state's pill, a
// priority's bars, a person's avatar or a record's chip, so the row
// draws no glyph before it.
export const leads = (p: Prop): boolean =>
  !!(p.kind === 'badge' || p.kind === 'priority' || p.kind === 'person' || p.kind === 'circle' || (p.people && p.people.length === 1) || (record(p.href) && !p.icon))

// The quiet word before a row's value: its slice's, else a day's name,
// as "issued" before the day an invoice was issued.
export const word = (p: Prop): string | undefined => p.lead ?? (p.kind === 'date' ? p.label.toLowerCase() : undefined)

// Whether a row's words only repeat what another row's record chip
// already names, as an invoice's billed name beside its client's chip.
const repeats = (p: Prop, chips: Set<string>): boolean =>
  !record(p.href) && !p.edit && !p.people && (p.kind === undefined || p.kind === 'text') && chips.has(String(p.value))

// The icon a row leads with where its value does not: a record's own,
// the field's glyph, a crowd's, else its kind's (`fallback`).
export const mark = (p: Prop, fallback: Component<any>, crowd: Component<any>): Component<any> | undefined =>
  leads(p) ? undefined : (p.icon ?? p.glyph ?? (p.people ? crowd : fallback))

// The order a reader needs: state first, then who and where, then what
// else it holds.
function rank(p: Prop): number {
  const s = sort(p)
  if (s === 'badge' || s === 'priority' || s === 'boolean') {
    return 0
  }
  if (s && !s.startsWith('own:')) {
    return 1
  }
  return s ? 2 : 3
}

const order = (name: string) => (name === 'Properties' ? 0 : name === 'Dates' ? 2 : 1)

/** The drawer's properties in their sections. */
export function sections(props: Prop[]): Section[] {
  const out: Section[] = []
  const chips = new Set(props.filter((p) => record(p.href)).map((p) => String(p.value)))
  for (const p of props) {
    if (repeats(p, chips)) {
      continue
    }
    const name = place(p)
    let s = out.find((x) => x.name === name)
    if (!s) {
      s = { name, rows: [] }
      out.push(s)
    }
    // A record named twice by fields read alike, as a motion's circle
    // that also put it, is one row.
    const kind = sort(p)
    const same = kind && !p.edit ? s.rows.find((r) => !r.prop.edit && sort(r.prop) === kind && r.prop.href === p.href && String(r.prop.value) === String(p.value)) : undefined
    if (same) {
      same.label = `${same.label} · ${p.label}`
      // One lead word cannot say two fields; their names on hover do.
      if (word(same.prop) !== word(p)) {
        same.prop = { ...same.prop, lead: undefined }
      }
      continue
    }
    s.rows.push({ prop: p, label: p.label })
  }
  for (const s of out) {
    // Properties' state first, then who and where.
    if (s.name === 'Properties') {
      s.rows = s.rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.prop) - rank(b.r.prop) || a.i - b.i).map(({ r }) => r)
    }
  }
  return out.map((s, i) => ({ s, i })).sort((a, b) => order(a.s.name) - order(b.s.name) || a.i - b.i).map(({ s }) => s)
}
