// A band's edges (index.md, bands and actions): its outline, a few long
// edges meeting at wide, rounded corners, its bends its own, drawn from
// its seed and the same on every build. Its top rises to a crest and its
// foot dips to a trough, each somewhere along the width and apart from
// the other; the corners at the screen's sides stand past it, so only the
// turns inside show rounded.
import { rng, roundedPath, type Point } from '@cella/brand'

/** The outline's corners in the band's own box, 0 to 1 each way. */
export function edges(seed: number): Point[] {
  const r = rng((seed * 2654435761) >>> 0)
  const span = (lo: number, hi: number) => lo + r() * (hi - lo)
  const crest = span(0.22, 0.78)
  // the trough stands well apart from the crest, so the band leans
  const trough = crest < 0.5 ? span(crest + 0.2, 0.8) : span(0.2, crest - 0.2)
  return [
    [-0.1, span(0.05, 0.17)],
    [crest, 0],
    [1.1, span(0.05, 0.17)],
    [1.1, span(0.84, 0.95)],
    [trough, 1],
    [-0.1, span(0.84, 0.95)],
  ]
}

const RADIUS = 0.07

/** The outline as an SVG path in `objectBoundingBox` units, which
 * stretch with the band's height. */
export const outlinePath = (seed: number) => roundedPath(edges(seed), RADIUS, (v) => v.toFixed(4))

/** The outline as a CSS `shape()`, its bends as the path's, but each
 * edge's depth measured from its own side and capped at `--reach`: a band
 * no taller than that is cut as the path cuts it, and a taller one, as a
 * stacked band on a phone, keeps its edges as deep as `--reach` allows,
 * so they never sink into its words. */
export function outlineShape(seed: number) {
  const poly = edges(seed)
  const x = (v: number) => `${(v * 100).toFixed(2)}%`
  const y = (v: number) =>
    v < 0.5
      ? `calc(${v.toFixed(4)} * min(100%, var(--reach)))`
      : `calc(100% - ${(1 - v).toFixed(4)} * min(100%, var(--reach)))`
  const at = ([px, py]: number[]) => `${x(px)} ${y(py)}`
  const n = poly.length
  const parts: string[] = []
  for (let k = 0; k < n; k++) {
    const p = poly[k]
    const a = poly[(k - 1 + n) % n]
    const b = poly[(k + 1) % n]
    const la = Math.hypot(a[0] - p[0], a[1] - p[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = Math.min(RADIUS, la / 2, lb / 2)
    const p1 = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r]
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r]
    parts.push(k === 0 ? `from ${at(p1)}` : `line to ${at(p1)}`, `curve to ${at(p2)} with ${at(p)}`)
  }
  return `shape(${parts.join(', ')}, close)`
}
