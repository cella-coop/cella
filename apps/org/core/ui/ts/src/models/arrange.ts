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

// Where a choice may move by `by`, -1 up or 1 down: past its neighbour in
// its accordion, and a choice under none past the choice or the whole
// accordion beside it; none where it is at the end of either.
function target(items: Placed[], at: number, by: -1 | 1): number | null {
  const p = items[at]
  const next = at + by
  if (!p || next < 0 || next >= items.length) {
    return null
  }
  if (p.group !== null) {
    return items[next]!.group === p.group ? next : null
  }
  const beside = items[next]!.group
  if (beside === null) {
    return next
  }
  let end = next
  while (items[end + by]?.group === beside) {
    end += by
  }
  return end
}

export const movable = (items: Placed[], at: number, by: -1 | 1): boolean => target(items, at, by) !== null

// A choice moved up or down, as `movable` allows.
export function moved(items: Placed[], at: number, by: -1 | 1): Placed[] {
  const to = target(items, at, by)
  if (to === null) {
    return items
  }
  const out = items.filter((_, i) => i !== at)
  out.splice(to, 0, items[at]!)
  return out
}

// The bounds of a run, its first choice and its last.
function bounds(rs: Run[], i: number): [number, number] {
  const r = rs[i]!
  return [r.items[0]!.at, r.items.at(-1)!.at]
}

export const shiftable = (items: Placed[], group: string, by: -1 | 1): boolean => {
  const rs = runs(items)
  const i = rs.findIndex((r) => r.group === group)
  return i >= 0 && i + by >= 0 && i + by < rs.length
}

// An accordion moved as a whole past the run beside it.
export function shifted(items: Placed[], group: string, by: -1 | 1): Placed[] {
  const rs = runs(items)
  const i = rs.findIndex((r) => r.group === group)
  if (!shiftable(items, group, by)) {
    return items
  }
  const [a, b] = by < 0 ? [i - 1, i] : [i, i + 1]
  const [s, m] = bounds(rs, a)
  const [n, e] = bounds(rs, b)
  return [...items.slice(0, s), ...items.slice(n, e + 1), ...items.slice(s, m + 1), ...items.slice(e + 1)]
}

// A choice put under the accordion named, at its end, or, where there is
// none of that name, into one of its own where it stands, or under none
// where the name is blank.
export function regrouped(items: Placed[], at: number, name: string): Placed[] {
  const group = name.trim() || null
  const p = items[at]
  if (!p) {
    return items
  }
  const rest = items.filter((_, i) => i !== at)
  const last = group === null ? -1 : rest.findLastIndex((q) => q.group === group)
  const out = last < 0 ? items.map((q, i) => (i === at ? { ...q, group } : q)) : [...rest.slice(0, last + 1), { ...p, group }, ...rest.slice(last + 1)]
  return gathered(out)
}

// An accordion renamed on each of its choices, or dissolved where the
// name is blank, then gathered, as another of that name joins it.
export function renamed(items: Placed[], group: string, name: string): Placed[] {
  const to = name.trim() || null
  return gathered(items.map((p) => (p.group === group ? { ...p, group: to } : p)))
}
