// A `Repeat`'s rows, added, removed and reordered: plain functions
// `RepeatState` wraps in reactive state, which tests run without a
// browser, as `models/drag.ts`'s moves do.

export function added<T>(rows: T[], make: () => T): T[] {
  return [...rows, make()]
}

export function removed<T>(rows: T[], i: number): T[] {
  return rows.filter((_, j) => j !== i)
}

// `from` moved to sit at `to`, the rest keeping their order; unchanged
// where there is nothing to move or nowhere for it to go.
export function moved<T>(rows: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= rows.length || to < 0 || to >= rows.length) {
    return rows
  }
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}
