// The cut: the edge where a band's colour meets its print (index.md, the
// cut), drawn as an edge of the mark's cells is: two straight runs and one
// turn, the colour convex as a cell, bulging into the picture, its turn
// rounded. It is a clip path in its overlay's own units, 0 to 1,
// seeded, so a placement's cut is its own and the same on every build.
import { rng } from '@cella/brand'

type Point = [number, number]

/** A string's seed. */
const seedOf = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** A closed path through a polygon's corners, those `soft` names
 * rounded by `rad`. */
function rounded(poly: Point[], soft: boolean[], rad: number, f: (p: Point) => string): string {
  const n = poly.length
  let d = ''
  for (let k = 0; k < n; k++) {
    const p = poly[k]
    const a = poly[(k - 1 + n) % n]
    const b = poly[(k + 1) % n]
    const la = Math.hypot(a[0] - p[0], a[1] - p[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = soft[k] ? Math.min(rad, la / 2, lb / 2) : 0
    const p1: Point = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r]
    const p2: Point = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r]
    d += `${k === 0 ? 'M' : 'L'}${f(p1)}Q${f(p)} ${f(p2)}`
  }
  return `${d}Z`
}

/**
 * The colour's shape as the `d` of a clip path in its overlay's units.
 * Built with the colour on the left, its edge running from the top to the
 * foot; `turn` names the colour's side as drawn: `left`, `right`, or
 * `below` for a print above its words. `reach` is how far into the
 * overlay the edge stands, from its least to its most.
 */
export function cut(key: string, turn: 'left' | 'right' | 'below' = 'left', { reach = [0.3, 0.62], round = 0.06 } = {}): string {
  const rand = rng(seedOf(key))
  const [lo, hi] = reach
  const at = (t: number) => lo + (hi - lo) * t
  // the edge's ends, and one bend standing out past both, so the colour
  // is convex
  const top: Point = [at(rand() * 0.45), 0]
  const foot: Point = [at(rand() * 0.45), 1]
  const bends: Point[] = [[at(0.75 + rand() * 0.25), 0.35 + rand() * 0.3]]
  // a bend that would dent the colour inward goes, so it stays convex
  const edge = [top, ...bends, foot].filter((p, k, all) => {
    if (k === 0 || k === all.length - 1) {
      return true
    }
    const [a, b] = [all[k - 1], all[k + 1]]
    const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])
    // y runs down, so a bend out past its neighbours' line crosses positive
    return cross > 0
  })
  const poly: Point[] = [[-0.1, -0.1], [edge[0][0], -0.1], ...edge.slice(1, -1), [edge[edge.length - 1][0], 1.1], [-0.1, 1.1]]
  const soft = poly.map((_, k) => k > 1 && k < poly.length - 2)
  const f = (p: Point) => {
    const [x, y] = turn === 'left' ? p : turn === 'right' ? [1 - p[0], p[1]] : [p[1], 1 - p[0]]
    return `${+x.toFixed(4)} ${+y.toFixed(4)}`
  }
  return rounded(poly, soft, round, f)
}
