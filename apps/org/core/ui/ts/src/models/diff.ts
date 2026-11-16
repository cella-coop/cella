// A change shown as a diff, rich and in the change's own terms, never a
// programmer's text diff: one kind a shape. An arrangement, as a
// circle's features, is drawn as its tree once changed, each choice
// marked added, moved from another accordion or the top level, or
// reordered within its own, its accordions marked where they are new,
// and those it no longer shows listed as removed; a plain value as the
// one in force struck through and the new one after it.

import { listed, runs, type Placed } from './arrange.ts'

export type Mark = 'added' | 'moved' | 'reordered' | null

export type Line =
  | { kind: 'head'; group: string; added: boolean }
  | { kind: 'choice'; value: string; depth: 0 | 1; mark: Mark; from?: string | null }

export interface Arranged {
  lines: Line[]
  removed: Placed[]
  // Whether anything changed at all.
  changed: boolean
}

// The longest run of `a` that `b` keeps in the same order, as a set.
function kept(a: string[], b: string[]): Set<string> {
  const n = a.length
  const m = b.length
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!)
    }
  }
  const out = new Set<string>()
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) {
      out.add(a[i]!)
      i++
      j++
    } else if (t[i + 1]![j]! >= t[i]![j + 1]!) {
      i++
    } else {
      j++
    }
  }
  return out
}

// Two listings of an arrangement compared: the new one's tree with each
// choice marked, and the choices it drops.
export function arranged(was: string, now: string): Arranged {
  const before = listed(was)
  const after = listed(now)
  const old = new Map(before.map((p) => [p.value, p]))
  const groups = new Set(before.flatMap((p) => (p.group === null ? [] : [p.group])))
  // Those in both under the same accordion or none keep their order but
  // for the fewest, which are the ones reordered.
  const stay = (list: Placed[], other: Map<string, Placed>) =>
    list.filter((p) => other.has(p.value) && other.get(p.value)!.group === p.group).map((p) => p.value)
  const order = kept(stay(before, new Map(after.map((p) => [p.value, p]))), stay(after, old))
  const lines: Line[] = []
  let changed = false
  const mark = (p: Placed): Mark => {
    const o = old.get(p.value)
    const m: Mark = !o ? 'added' : o.group !== p.group ? 'moved' : order.has(p.value) ? null : 'reordered'
    changed ||= m !== null
    return m
  }
  for (const run of runs(after)) {
    if (run.group !== null) {
      lines.push({ kind: 'head', group: run.group, added: !groups.has(run.group) })
    }
    for (const { placed } of run.items) {
      const m = mark(placed)
      lines.push({ kind: 'choice', value: placed.value, depth: run.group === null ? 0 : 1, mark: m, ...(m === 'moved' ? { from: old.get(placed.value)!.group } : {}) })
    }
  }
  const removed = before.filter((p) => !after.some((q) => q.value === p.value))
  return { lines, removed, changed: changed || removed.length > 0 }
}

// A feature's name by its value, as Settings' features page names it.
export const named = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)
