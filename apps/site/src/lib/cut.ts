// The cut: the edge where a section's colour flows over its print, after
// the mark (index.md, the cut). The mark is cells, each the Voronoi cell
// of its seed among seeds no one sees, rounded at its corners and kept
// apart by a gutter; here the colour is cells too. Near its own side it is
// whole, drawn as one shape, the union of its cells, so its edge is a
// rounded coastline of cells; past that, loose cells of it float over the
// picture, the fewer the further in. No loose cell touches the overlay's
// box, so none is cut to a straight line. It is a clip path in the box's
// own units, 0 to 1, seeded, so a placement's cut is its own and the same
// on every build.
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

/** A string's seed. */
const seedOf = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * The cut of a colour flowing over a print, as the `d` of clip paths in
 * object-bounding-box units. `toward` names where the colour flows: to
 * the `right`, from the box's left edge, or to the `top`, from its foot.
 * `aspect` is the box's depth over its length, the depth the way the
 * colour flows, so the cells stay round in it. A cell is `pitch` of the
 * box's length across.
 */
export function cut(key: string, toward: 'right' | 'top', { aspect = 0.8, pitch = 10, whole = 0.3, gutter = 1.8, round = 1.6 } = {}): string[] {
  const rand = rng(seedOf(key))
  // Built with the colour flowing along x, from 0 to D, its length along y
  const H = 100
  const D = H * aspect
  const cells: { p: Point; kind: 'loose' | 'gone' | 'whole' }[] = []
  const cols = Math.max(3, Math.round(D / pitch))
  for (let c = 0; c < cols; c++) {
    const x0 = (c + 0.5) * (D / cols)
    const at = x0 / D
    // whole near its own side; past it a cell is kept the likelier the
    // nearer the whole it lies
    const keep = Math.max(0, 0.85 - 1.1 * (at - whole) / (1 - whole))
    for (let y = -pitch; y < H + pitch; y += pitch) {
      const p: Point = [x0 + (rand() - 0.5) * pitch * 0.7, y + (rand() - 0.5) * pitch * 0.7 + (c % 2) * pitch * 0.5]
      cells.push({ p, kind: at < whole ? 'whole' : rand() < keep ? 'loose' : 'gone' })
    }
  }
  // seeds past the far side, so the farthest cells close
  for (let y = -pitch; y < H + pitch; y += pitch) {
    cells.push({ p: [D + pitch * 0.9, y + rand() * pitch], kind: 'gone' })
  }
  const seeds = cells.map((c) => c.p)
  const box: Point[] = [[-20, -20], [D + 20, -20], [D + 20, H + 20], [-20, H + 20]]
  const f = (p: Point) => {
    const [u, v] = toward === 'right' ? [p[0] / D, p[1] / H] : [p[1] / H, 1 - p[0] / D]
    return `${+u.toFixed(4)} ${+v.toFixed(4)}`
  }
  const isWhole = (n: number) => cells[n].kind === 'whole'
  const paths: string[] = []
  // A loose cell keeps a gutter from every neighbour, rounded, and is left
  // out where it would touch the box, so none is cut straight
  const m = gutter
  cells.forEach((c, i) => {
    if (c.kind !== 'loose') {
      return
    }
    const poly = cell(seeds, i, box, () => gutter / 2)
    const inside = poly.every(([x, y]) => x > m && x < D - m && y > m && y < H - m)
    if (poly.length >= 3 && inside) {
      paths.push(rounded(poly, round, f))
    }
  })
  // The whole is one shape, its cells' union: each keeps a gutter from
  // what is not whole and none from what is, their shared edges cancel,
  // and what is left is one outline, its thorns merged away, rounded
  const edges = new Map<string, [Point, Point]>()
  const spot = (p: Point) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`
  cells.forEach((c, i) => {
    if (c.kind !== 'whole') {
      return
    }
    const poly = cell(seeds, i, box, (n) => (isWhole(n) ? 0 : gutter / 2))
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
    const kept = smooth(loop, round * 0.8)
    if (kept.length >= 3) {
      paths.push(rounded(kept, round * 1.5, f))
    }
  }
  return paths
}
