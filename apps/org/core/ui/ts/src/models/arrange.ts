// An arrangement's model: choices each on or off, those on in an order,
// each perhaps under a named accordion, an accordion's choices always
// together; written as one listing, the choices on in order separated by
// commas, an accordion's run after its name and a colon, the runs
// separated by semicolons: `Books: account, transaction; contact`. It is
// how a circle's features are written, and spelt here as `circle.spell`
// spells them, so a listing changed back reads as unchanged.

// A choice on, in its place, under its accordion or none.
export interface Placed {
  value: string
  group: string | null
}

// A run of the arrangement: an accordion's choices under its name, or a
// choice under none, which moves alone.
export interface Run {
  group: string | null
  items: { placed: Placed; at: number }[]
}

// A listing read into its choices, in order; a run's name blank is none.
export function listed(listing: string): Placed[] {
  return listing
    .split(';')
    .flatMap((run) => {
      const colon = run.indexOf(':')
      const group = colon >= 0 ? run.slice(0, colon).trim() || null : null
      return (colon >= 0 ? run.slice(colon + 1) : run).split(',').map((v) => ({ value: v.trim(), group }))
    })
    .filter((p) => p.value !== '')
}

// Choices spelt as one listing: each run of an accordion's after its name
// and a colon, consecutive choices under none as one run, the runs
// separated by `; `, the choices by `, `.
export function spell(items: Placed[]): string {
  const runs: { group: string | null; values: string[] }[] = []
  for (const p of items) {
    const last = runs.at(-1)
    if (last && last.group === p.group) {
      last.values.push(p.value)
    } else {
      runs.push({ group: p.group, values: [p.value] })
    }
  }
  return runs.map((r) => (r.group === null ? '' : `${r.group}: `) + r.values.join(', ')).join('; ')
}

// The runs as the arrangement shows them: an accordion's choices
// together, each choice under none a run of its own.
export function runs(items: Placed[]): Run[] {
  const out: Run[] = []
  items.forEach((placed, at) => {
    const last = out.at(-1)
    if (placed.group !== null && last && last.group === placed.group) {
      last.items.push({ placed, at })
    } else {
      out.push({ group: placed.group, items: [{ placed, at }] })
    }
  })
  return out
}

// An accordion's choices gathered where it first appears, so no accordion
// is listed apart.
export function gathered(items: Placed[]): Placed[] {
  const seen = new Set<string>()
  return items.flatMap((p) => {
    if (p.group === null) {
      return [p]
    }
    if (seen.has(p.group)) {
      return []
    }
    seen.add(p.group)
    return items.filter((q) => q.group === p.group)
  })
}

// A choice turned on, at the end under none, or off.
export function toggled(items: Placed[], value: string, on: boolean): Placed[] {
  const without = items.filter((p) => p.value !== value)
  return on ? [...without, { value, group: null }] : without
}

// What a drag lifts in an arrangement: one choice, on show or not, or an
// accordion with its choices.
export type Lifted = { kind: 'choice'; value: string } | { kind: 'accordion'; group: string }

// Where a lifted thing may land: at an index of the choices left once it
// is lifted, under an accordion or none, or among the choices not shown.
// One gap may be two places, the end of an accordion and the top level
// just after it, which the depth tells apart.
export type Target = { kind: 'at'; group: string | null; index: number } | { kind: 'off' }
// A row the arrangement draws, in order: a place a lifted thing may land
// on (`at`, its index among the targets), an accordion's head, which is
// `empty` while it was just made and holds nothing, or a choice on show,
// in an accordion or at the top level.
export type Row =
  | { kind: 'place'; at: number; target: Target; depth: 0 | 1 }
  | { kind: 'head'; group: string; empty: boolean }
  | { kind: 'choice'; placed: Placed; depth: 0 | 1 }

// The arrangement as it is drawn, its places among its rows while
// something is lifted, and the places a lifted thing may land on, in the
// order drawn, with the one it was lifted from. A choice lands before any
// choice, at the end of any accordion, between the runs at the top level,
// in an accordion just made and still empty (`empty`, drawn last), or
// among those not shown, the last target; an accordion lands between the
// runs at the top level, or among those not shown, which turns all its
// choices off. A choice alone in its accordion keeps that accordion as a
// place while it is lifted, so it may be dropped back. Where it is
// `grouped`, a choice lands in an accordion only, never at the top level.
export function drawn(items: Placed[], lifted: Lifted | null, empty: string[] = [], grouped = false): { rows: Row[]; targets: Target[]; from: number } {
  const rows: Row[] = []
  const out: Target[] = []
  let from = -1
  let idx = 0
  const place = (t: Target & { kind: 'at' }) => {
    if (!lifted || (grouped && lifted.kind === 'choice' && t.group === null)) {
      return
    }
    const last = out.at(-1)
    if (!(last?.kind === 'at' && last.group === t.group && last.index === t.index)) {
      rows.push({ kind: 'place', at: out.length, target: t, depth: t.group === null ? 0 : 1 })
      out.push(t)
    }
  }
  const choosing = lifted?.kind === 'choice' ? lifted.value : null
  for (const run of runs(items)) {
    if (run.group === null) {
      const p = run.items[0]!.placed
      if (p.value !== choosing) {
        place({ kind: 'at', group: null, index: idx })
        idx += 1
      }
      rows.push({ kind: 'choice', placed: p, depth: 0 })
      continue
    }
    const whole = lifted?.kind === 'accordion' && lifted.group === run.group
    if (whole) {
      from = out.length
    }
    place({ kind: 'at', group: null, index: idx })
    rows.push({ kind: 'head', group: run.group, empty: false })
    for (const { placed } of run.items) {
      if (placed.value === choosing) {
        from = out.length
      }
      if (lifted?.kind !== 'accordion') {
        place({ kind: 'at', group: run.group, index: idx })
      }
      rows.push({ kind: 'choice', placed, depth: 1 })
      if (placed.value !== choosing && !whole) {
        idx += 1
      }
    }
    if (lifted?.kind !== 'accordion') {
      place({ kind: 'at', group: run.group, index: idx })
    }
  }
  place({ kind: 'at', group: null, index: idx })
  if (choosing !== null) {
    const at = items.findIndex((p) => p.value === choosing)
    if (at >= 0 && items[at]!.group === null) {
      // A choice at the top level was where the gap it leaves is.
      from = out.findIndex((t) => t.kind === 'at' && t.group === null && t.index === at)
    }
  }
  for (const g of empty) {
    if (!items.some((p) => p.group === g)) {
      rows.push({ kind: 'head', group: g, empty: true })
      if (choosing !== null) {
        place({ kind: 'at', group: g, index: idx })
      }
    }
  }
  if (lifted) {
    out.push({ kind: 'off' })
  }
  return { rows, targets: out, from: from < 0 ? out.length - 1 : from }
}

// The places a lifted thing may land on, as `drawn` draws them, and the
// one it was lifted from.
export function targets(items: Placed[], lifted: Lifted, empty: string[] = [], grouped = false): { targets: Target[]; from: number } {
  const d = drawn(items, lifted, empty, grouped)
  return { targets: d.targets, from: d.from }
}

// The arrangement once the lifted thing lands on a target: a choice at
// its index under the target's accordion, or off; an accordion's choices
// together at the index, or all off.
export function landed(items: Placed[], lifted: Lifted, target: Target): Placed[] {
  const moving = lifted.kind === 'choice' ? [{ value: lifted.value, group: null }] : items.filter((p) => p.group === lifted.group)
  const keys = new Set(moving.map((p) => p.value))
  const rest = items.filter((p) => !keys.has(p.value))
  if (target.kind === 'off') {
    return rest
  }
  const placed = lifted.kind === 'choice' ? [{ value: lifted.value, group: target.group }] : moving
  return gathered([...rest.slice(0, target.index), ...placed, ...rest.slice(target.index)])
}

// A target in words, as a keyboard drag announces it: in which accordion
// and where, at the top level after what, or not shown.
export function described(items: Placed[], lifted: Lifted, target: Target, named: (value: string) => string): string {
  if (target.kind === 'off') {
    return lifted.kind === 'choice' ? 'Not shown' : `Not shown, with every feature of ${lifted.group}`
  }
  const keys = new Set(lifted.kind === 'choice' ? [lifted.value] : items.filter((p) => p.group === lifted.group).map((p) => p.value))
  const rest = items.filter((p) => !keys.has(p.value))
  if (target.group !== null) {
    const first = rest.findIndex((p) => p.group === target.group)
    const count = rest.filter((p) => p.group === target.group).length
    return `In ${target.group}, position ${first < 0 ? 1 : target.index - first + 1} of ${count + 1}`
  }
  const before = rest[target.index - 1]
  return before ? `At the top level, after ${before.group ?? named(before.value)}` : 'At the top level, first'
}

// An accordion renamed on each of its choices, or dissolved where the
// name is blank, then gathered, as another of that name joins it.
export function renamed(items: Placed[], group: string, name: string): Placed[] {
  const to = name.trim() || null
  return gathered(items.map((p) => (p.group === group ? { ...p, group: to } : p)))
}

// A lifted thing by the key its row carries: `c:` a choice's value, `a:`
// an accordion's name.
export const keyOf = (l: Lifted) => (l.kind === 'choice' ? `c:${l.value}` : `a:${l.group}`)
export const unkeyed = (key: string | null): Lifted | null =>
  key?.startsWith('c:') ? { kind: 'choice', value: key.slice(2) } : key?.startsWith('a:') ? { kind: 'accordion', group: key.slice(2) } : null
