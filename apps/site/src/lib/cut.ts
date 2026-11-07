// The cut: the edge a print meets the page along, after the mark
// (index.md, prints). The mark is cells, each the Voronoi cell of its seed
// among seeds no one sees, shrunk by a gutter and rounded at its corners;
// the cut is a band of such cells along the print's edge, some kept and
// the rest cut away, kept the likelier the further into the print, so
// the picture breaks into cells where it meets the ground. Beyond the band
// the print is whole. It is a clip path in the box's own units, 0 to 1,
// seeded, so a placement's cut is its own and the same on every build.
import { rng } from '@cella/brand'

type Point = [number, number]

/** The part of a convex polygon on the near side of a line through
 * (px, py) with normal (nx, ny); the mark's own construction. */
function clipHalf(poly: Point[], px: number, py: number, nx: number, ny: number): Point[] {
  const out: Point[] = []
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k]
    const b = poly[(k + 1) % poly.length]
    const da = (a[0] - px) * nx + (a[1] - py) * ny
    const db = (b[0] - px) * nx + (b[1] - py) * ny
    if (da <= 0) {
      out.push(a)
    }
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db)
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

/** A closed path through a polygon's corners, each softened to a curve. */
function rounded(poly: Point[], rad: number, f: (p: Point) => string): string {
  const n = poly.length
  let d = ''
  for (let k = 0; k < n; k++) {
    const p = poly[k]
    const a = poly[(k - 1 + n) % n]
    const b = poly[(k + 1) % n]
    const la = Math.hypot(a[0] - p[0], a[1] - p[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = Math.min(rad, la / 2, lb / 2)
    const p1: Point = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r]
    const p2: Point = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r]
    d += `${k === 0 ? 'M' : 'L'}${f(p1)}Q${f(p)} ${f(p2)}`
  }
  return `${d}Z`
}

/** A cell's polygon: the box cut by every other seed's bisector, moved in
 * by what `inset` gives for that neighbour. */
function cell(seeds: Point[], a: number, box: Point[], inset: (b: number) => number): Point[] {
  let poly = box
  const s = seeds[a]
  for (let b = 0; b < seeds.length && poly.length >= 3; b++) {
    if (a === b) {
      continue
    }
    const t = seeds[b]
    const dx = t[0] - s[0]
    const dy = t[1] - s[1]
    const d = Math.hypot(dx, dy)
    const nx = dx / d
    const ny = dy / d
    poly = clipHalf(poly, (s[0] + t[0]) / 2 - nx * inset(b), (s[1] + t[1]) / 2 - ny * inset(b), nx, ny)
  }
  return poly
}

/** A string's seed. */
const seedOf = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * A print's cut as the `d` of clip paths in object-bounding-box units.
 * `edge` names the side of the print the page meets: `start` its left,
 * `end` its right, `bottom` its foot. The band of cells is `depth` of the
 * print's width (or height), a hundred units across the box.
 */
export function cut(key: string, edge: 'start' | 'end' | 'bottom', { depth = 26, pitch = 9, gutter = 1.6, round = 1.4 } = {}): string[] {
  const rand = rng(seedOf(key))
  const L = 100
  // The cells run on past the band into the print, where every one is
  // whole print, so the print's own edge is cells and never a line
  const span = depth + pitch * 2
  // Built with the band at the left, x from 0, along y; turned after
  const cells: { p: Point; kind: 'loose' | 'gone' | 'whole' }[] = []
  const cols = Math.max(3, Math.round(span / pitch))
  for (let c = 0; c < cols; c++) {
    const x0 = (c + 0.5) * (span / cols)
    // past the band a cell is the whole print; in it, a loose cell is kept
    // the likelier the further into the print it lies
    const keep = 0.15 + 0.7 * Math.min(1, x0 / depth)
    for (let y = -pitch; y < L + pitch; y += pitch) {
      const p: Point = [x0 + (rand() - 0.5) * pitch * 0.7, y + (rand() - 0.5) * pitch * 0.7 + (c % 2) * pitch * 0.5]
      cells.push({ p, kind: x0 > depth ? 'whole' : rand() < keep ? 'loose' : 'gone' })
    }
  }
  // seeds outside the box on the page's side, so the outer cells close
  const outside: Point[] = []
  for (let y = -pitch; y < L + pitch; y += pitch) {
    outside.push([-pitch * 0.9, y + rand() * pitch])
  }
  const seeds = [...cells.map((b) => b.p), ...outside]
  const box: Point[] = [[-20, -20], [L + 20, -20], [L + 20, L + 20], [-20, L + 20]]
  const turn = (p: Point): Point => (edge === 'start' ? p : edge === 'end' ? [L - p[0], p[1]] : [p[1], L - p[0]])
  const f = (p: Point) => {
    const [x, y] = turn(p)
    return `${+(x / L).toFixed(4)} ${+(y / L).toFixed(4)}`
  }
  const whole = (n: number) => n < cells.length && cells[n].kind === 'whole'
  const paths: string[] = []
  // A loose cell keeps a gutter from every neighbour, as the mark's cells
  // do, rounded, and no cell is cut flat by the box's edge
  cells.forEach((c, i) => {
    if (c.kind !== 'loose') {
      return
    }
    const poly = clipHalf(cell(seeds, i, box, () => gutter / 2), gutter / 2, 0, -1, 0)
    if (poly.length >= 3) {
      paths.push(rounded(poly, round, f))
    }
  })
  // The whole print is one shape, its cells' union: each keeps a gutter
  // from what is not whole and none from what is, their shared edges
  // cancel, and what is left is one outline, rounded at every corner, so
  // no seam, crack or notch shows where its cells meet
  const edges = new Map<string, [Point, Point]>()
  const spot = (p: Point) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`
  cells.forEach((c, i) => {
    if (c.kind !== 'whole') {
      return
    }
    const poly = cell(seeds, i, box, (n) => (whole(n) ? 0 : gutter / 2))
    poly.forEach((a, k) => {
      const b = poly[(k + 1) % poly.length]
      const back = `${spot(b)}>${spot(a)}`
      if (edges.has(back)) {
        edges.delete(back)
      } else {
        edges.set(`${spot(a)}>${spot(b)}`, [a, b])
      }
    })
  })
  const from = new Map([...edges.values()].map(([a, b]) => [spot(a), b]))
  const loops: Point[][] = []
  while (from.size) {
    const [start, next] = from.entries().next().value as [string, Point]
    const loop: Point[] = []
    let at = start
    let to: Point | undefined = next
    while (to) {
      from.delete(at)
      loop.push(to)
      at = spot(to)
      to = at === start ? undefined : from.get(at)
    }
    loops.push(loop)
  }
  for (const loop of loops) {
    const kept = smooth(loop, round * 0.8)
    if (kept.length >= 3) {
      paths.push(rounded(kept, round * 1.5, f))
    }
  }
  return paths
}

/** An outline without its thorns: a corner too near the last leaves no
 * room to round either, and one sharper than 55° no rounding softens, so
 * both go, again until none is left. */
function smooth(loop: Point[], near: number): Point[] {
  let pts = loop
  for (let changed = true; changed && pts.length > 3; ) {
    changed = false
    const out: Point[] = []
    pts.forEach((p, k) => {
      const a = out.length ? out[out.length - 1] : pts[(k - 1 + pts.length) % pts.length]
      const b = pts[(k + 1) % pts.length]
      const ax = a[0] - p[0]
      const ay = a[1] - p[1]
      const bx = b[0] - p[0]
      const by = b[1] - p[1]
      const la = Math.hypot(ax, ay)
      const lb = Math.hypot(bx, by)
      const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb || 1))))
      if (la < near || angle < (55 * Math.PI) / 180) {
        changed = true
        return
      }
      out.push(p)
    })
    if (out.length < 3) {
      break
    }
    pts = out
  }
  return pts
}
