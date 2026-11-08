// The brand's cells beyond the mark: a cluster of them that a picture is
// cut into, and a lone cell for a marker. A cluster is a power diagram, a
// Voronoi diagram whose seeds weigh their disk's area, so a big seed owns
// a big cell: the disks' radii follow a power law, a few large and a long
// tail of small, the large gathered in the middle, and the cluster's edge
// a lobed blob with a tail, never its box. Given a picture's focus, the
// regions it is of, the largest cells are seeded on them, each holding
// its region whole and centred, and the rest shrink away from them;
// given a silhouette, an organic one or a mask's, the cells fill that.

import { clipHalf, rng, roundedPath, type Point } from './mark.ts'
import { organic, type Field, type Organic } from './silhouette.ts'

/** A cluster's outline: the lobed blob, an organic shape by name, or a
 * signed distance in the box's units, negative inside, with how deep in
 * it the cells reach their full size. */
export type Silhouette = 'blob' | Organic | { kind: Organic; limbs?: number } | { field: Field; depth?: number }

/** A region of a cluster's box, its centre and radius in the box's units. */
export type Focus = { x: number; y: number; r: number }

export type ClusterOptions = {
  /** The typical cell's size, in the box's units. */
  pitch: number
  /** The cut between two cells, the same between any two. */
  gutter: number
  /** A corner's rounding, at most. */
  round: number
  seed: number
  /** The share of the rim's cells left out, so the edge breaks. */
  drop?: number
  /** A side the cluster runs off, past the box's edge. */
  bleed?: 'l' | 'r' | null
  silhouette?: Silhouette
  /** What the picture is of: regions of the box, each held whole by one
   * of the largest cells, centred in it, the cells shrinking away. */
  focus?: Focus[]
  /** How many of the loose cells past the rim stay, against the default. */
  loose?: number
}

const f = (v: number) => v.toFixed(1)

/** How far a cell may reach from its seed, in its disk's radii, and the
 * sides of the polygon that bounds it. */
const REACH = 1.5
const REACH_SIDES = 14

/** A cluster's cells, as SVG paths, in a box w by h. */
export function cluster(w: number, h: number, { pitch, gutter, round, seed, drop = 0, bleed = null, silhouette = 'blob', focus = [], loose = 1 }: ClusterOptions): string[] {
  const [rmin, rmax, alpha] = [pitch * 0.2, pitch * 1.3, 1.5]
  const sep = gutter * 0.4
  const foci = seat(focus, { w, h, gutter, sep, rmax, bleed })

  // The outline: a blob whose radius wobbles with the angle, and a lobe,
  // its tail. Bleeding off one side, its middle leans toward that edge and
  // its tail points back the other way, toward the words; given a focus,
  // halfway toward its regions' middle
  const shape = rng(seed * 7 + 3)
  const [a, b, c] = [shape() * 6.3, shape() * 6.3, shape() * 6.3]
  const lean = bleed === 'r' ? 0.14 : bleed === 'l' ? -0.14 : 0
  let [cx, cy] = [w * (0.5 + lean) + (shape() - 0.5) * w * 0.06, h / 2 + (shape() - 0.5) * h * 0.08]
  if (foci.length) {
    const mass = foci.reduce((s, d) => s + d.r * d.r, 0)
    cx = (cx + foci.reduce((s, d) => s + d.x * d.r * d.r, 0) / mass) / 2
    cy = (cy + foci.reduce((s, d) => s + d.y * d.r * d.r, 0) / mass) / 2
  }
  const tail = bleed === 'r' ? Math.PI + (shape() - 0.5) * 1.4 : bleed === 'l' ? (shape() - 0.5) * 1.4 : shape() * 6.3
  const blob = (x: number, y: number) => {
    let u = (x - cx) / (w / 2)
    // toward the bleeding edge the outline reaches past it
    if ((bleed === 'r' && u > 0) || (bleed === 'l' && u < 0)) {
      u *= 0.5
    }
    const v = (y - cy) / (h / 2)
    const t = Math.atan2(v, u)
    const lobe = 0.55 * Math.max(0, Math.cos(t - tail)) ** 4
    const R = 0.86 * (1 + 0.18 * Math.sin(2 * t + a) + 0.11 * Math.sin(3 * t + b) + 0.06 * Math.sin(5 * t + c) + lobe)
    return Math.hypot(u, v) / Math.min(0.97 * (1 + lobe), R)
  }
  const shaped = silhouette === 'blob' ? blob : depthOf(silhouette, { w, h, pitch, seed, bleed, cx })
  // how far from the nearest focus disk, 0 on it and 1 a reach of the
  // focus beyond it, so the cells close round a focus however the
  // silhouette falls
  const away = (x: number, y: number) => foci.reduce((m, d) => Math.min(m, Math.max(0, Math.hypot(x - d.x, y - d.y) - d.r) / (pitch * NEAR)), Infinity)
  const outline = foci.length ? (x: number, y: number) => Math.min(shaped(x, y), away(x, y)) : shaped

  // The seeds: disks whose radii follow a power law, packed biggest first
  // at random spots without overlapping, over the box and a margin round
  // it, after the focus's own. How big a disk may be falls off from the
  // middle, so the big cells gather there and the rim and the tail break
  // into ever smaller ones; given a focus, it falls off from the focus
  // too, so the cells shrink away from it as well as toward the rim
  const rand = rng(seed)
  // the blob's outline is how far from its middle, so its falloff is
  // steepened to its rim; any other is how deep in it, and a cell grows
  // only as deep as it stands. Far from a focus the cap still lets the
  // smallest disks in, so the background fills with small cells
  const steep = silhouette === 'blob' ? 3 : 1
  const rim = (x: number, y: number) => 1.05 - outline(x, y) ** steep * 0.85
  const size = foci.length ? (x: number, y: number) => Math.min(rim(x, y), 0.28 + 0.6 * Math.exp(-(away(x, y) ** 2) * 3)) : rim
  const cap = (x: number, y: number) => rmax * Math.max(0.12, size(x, y)) ** 1.6
  const margin = rmax
  // enough disks to fill the box with small ones, at any pitch
  const count = Math.max(1400, Math.round((2.5 * (w + margin * 2) * (h + margin * 2)) / (Math.PI * rmin * rmin)))
  const radii = Array.from({ length: count }, () => Math.min(rmax, rmin * (1 - rand()) ** (-1 / alpha))).sort((p, q) => q - p)
  const disks: { x: number; y: number; r: number }[] = []
  // the disks bucketed by a square no two touching disks span more than
  const span = Math.max(rmax, ...foci.map((d) => d.r)) * 2 + sep
  const buckets = new Map<number, { x: number; y: number; r: number }[]>()
  const key = (i: number, j: number) => i * 4096 + j
  for (const d of foci) {
    disks.push(d)
    const k = key(Math.floor(d.x / span), Math.floor(d.y / span))
    buckets.set(k, [...(buckets.get(k) ?? []), d])
  }
  const free = (x: number, y: number, r: number) => {
    const [i, j] = [Math.floor(x / span), Math.floor(y / span)]
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (buckets.get(key(i + di, j + dj))?.some((d) => Math.hypot(d.x - x, d.y - y) < d.r + r + sep)) {
          return false
        }
      }
    }
    return true
  }
  for (const r of radii) {
    for (let tries = 0; tries < 50; tries++) {
      const x = -margin + rand() * (w + margin * 2)
      const y = -margin + rand() * (h + margin * 2)
      if (r > Math.max(rmin, cap(x, y))) {
        continue
      }
      if (free(x, y, r)) {
        const d = { x, y, r }
        disks.push(d)
        const k = key(Math.floor(x / span), Math.floor(y / span))
        buckets.set(k, [...(buckets.get(k) ?? []), d])
        break
      }
    }
  }

  const box: Point[] = [[-margin * 2, -margin * 2], [w + margin * 2, -margin * 2], [w + margin * 2, h + margin * 2], [-margin * 2, h + margin * 2]]
  const paths: string[] = []
  disks.forEach((s, i) => {
    let poly = box
    for (let j = 0; j < disks.length && poly.length >= 3; j++) {
      const t = disks[j]
      const d = Math.hypot(t.x - s.x, t.y - s.y)
      if (i === j || d > (s.r + t.r) * REACH * 2) {
        continue
      }
      const [nx, ny] = [(t.x - s.x) / d, (t.y - s.y) / d]
      // the power bisector: where the two weighted distances meet, nearer
      // the lighter seed, less half the gutter, one width throughout
      const at = (d * d + s.r * s.r - t.r * t.r) / (2 * d) - gutter / 2
      poly = clipHalf(poly, s.x + nx * at, s.y + ny * at, nx, ny)
    }
    // and no further from its seed than a reach of its disk, so a cell on
    // the rim, with no neighbour beyond it, rounds off instead of running
    // out to a spike
    for (let k = 0; k < REACH_SIDES && poly.length >= 3; k++) {
      const [nx, ny] = [Math.cos((k / REACH_SIDES) * Math.PI * 2), Math.sin((k / REACH_SIDES) * Math.PI * 2)]
      poly = clipHalf(poly, s.x + nx * s.r * REACH, s.y + ny * s.r * REACH, nx, ny)
    }
    // a focus's cell is always kept, cut by the box where it runs past it
    if (i < foci.length) {
      for (const [px, py, nx, ny] of [[2, 0, -1, 0], [w - 2, 0, 1, 0], [0, 2, 0, -1], [0, h - 2, 0, 1]]) {
        if ((bleed !== 'l' || nx !== -1) && (bleed !== 'r' || nx !== 1)) {
          poly = clipHalf(poly, px, py, nx, ny)
        }
      }
      if (poly.length >= 3) {
        paths.push(roundedPath(poly, Math.min(round, 0.3 * s.r), f))
      }
      return
    }
    // wholly inside the box, but on a bleeding side it may run off the edge
    const inside = poly.length >= 3 && poly.every(([x, y]) => (bleed === 'l' || x >= 2) && (bleed === 'r' || x <= w - 2) && y >= 2 && y <= h - 2)
    if (!inside || !cellLike(poly)) {
      return
    }
    // inside the outline, or a loose cell past it, the smaller the likelier
    const at = outline(s.x, s.y)
    const small = s.r < rmin * 1.6
    const stray = at >= 1 && at < (small ? 1.45 : 1.15) && rand() < (small ? 0.45 : 0.15) * loose
    if ((at >= 1 && !stray) ||(at < 1 && at > 0.9 && rand() < drop)) {
      return
    }
    paths.push(roundedPath(poly, Math.min(round, 0.3 * s.r), f))
  })
  return paths
}

/** How far from a focus, in pitches, the cells have shrunk to the rest. */
const NEAR = 2.5
/** How large a focus's disk grows, in the largest disk's radii, and how
 * large two regions merged into one may be. */
const SEAT = 1
const MERGE = 1.5

/** A focus's seeds: a disk on each region, wider than it by a gutter so
 * no gutter reaches it, and grown toward the largest disk's size while
 * it leaves its neighbours room. Disks apart keep their regions inside
 * their own power cells, so two regions become one, the circle round
 * both, where that fits a largest disk, or where they stand too close
 * for a gutter between them, unless that grows too large. Near an edge
 * the cluster does not bleed past, a disk moves in off it as far as its
 * region stays inside, so its cell is round, not cut by the box; a
 * region whose middle lies outside the box is left out. */
function seat(focus: Focus[], { w, h, gutter, sep, rmax, bleed }: { w: number; h: number; gutter: number; sep: number; rmax: number; bleed: 'l' | 'r' | null }) {
  let regions = focus.filter((f) => f.x >= 0 && f.x <= w && f.y >= 0 && f.y <= h && f.r > 0).map((f) => ({ ...f }))
  for (let merged = true; merged; ) {
    merged = false
    let best: [number, number, Focus] | undefined
    let gap = Infinity
    regions.forEach((p, i) => {
      regions.forEach((q, j) => {
        const g = Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r
        if (j <= i || g >= gap) {
          return
        }
        const round = enclose(p, q)
        if (round.r + gutter <= rmax * SEAT || (g < gutter * 2 + sep && round.r <= rmax * MERGE)) {
          best = [i, j, round]
          gap = g
        }
      })
    })
    if (best) {
      const [i, j, round] = best
      regions = [...regions.filter((_, k) => k !== i && k !== j), round]
      merged = true
    }
  }
  const floor = regions.map((p) => p.r + gutter)
  const disks = regions.map((p, i) => ({ x: p.x, y: p.y, r: Math.max(floor[i], rmax * SEAT) }))
  // a disk off the edges, moved no further from its region's middle than
  // its room above its floor, so the region stays a gutter inside it
  const shift = () => {
    disks.forEach((d, i) => {
      const { x, y } = regions[i]
      const within = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)))
      const [tx, ty] = [within(x, bleed === 'l' ? -Infinity : d.r + 2, bleed === 'r' ? Infinity : w - d.r - 2), within(y, d.r + 2, h - d.r - 2)]
      const [dx, dy] = [tx - x, ty - y]
      const k = Math.min(1, (d.r - floor[i]) / (Math.hypot(dx, dy) || 1))
      d.x = x + dx * k
      d.y = y + dy * k
    })
  }
  // two disks that overlap give up what they have above their floors, each
  // in proportion to what it has
  for (let round = 0; round < 20; round++) {
    shift()
    let moved = false
    disks.forEach((p, i) => {
      disks.forEach((q, j) => {
        const excess = p.r + q.r + sep - Math.hypot(p.x - q.x, p.y - q.y)
        if (j <= i || excess <= 1e-6) {
          return
        }
        const [si, sj] = [p.r - floor[i], q.r - floor[j]]
        if (si + sj <= 1e-6) {
          return
        }
        const cut = Math.min(excess, si + sj)
        p.r -= (cut * si) / (si + sj)
        q.r -= (cut * sj) / (si + sj)
        moved = true
      })
    })
    if (!moved) {
      break
    }
  }
  // however the rounds ended, no region strays out of its disk
  disks.forEach((d, i) => {
    const { x, y } = regions[i]
    const k = Math.min(1, (d.r - floor[i]) / (Math.hypot(d.x - x, d.y - y) || 1))
    d.x = x + (d.x - x) * k
    d.y = y + (d.y - y) * k
  })
  return disks
}

/** The smallest circle round two. */
function enclose(p: Focus, q: Focus): Focus {
  const d = Math.hypot(q.x - p.x, q.y - p.y)
  if (d + q.r <= p.r) {
    return { ...p }
  }
  if (d + p.r <= q.r) {
    return { ...q }
  }
  const r = (d + p.r + q.r) / 2
  const t = (r - p.r) / d
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, r }
}

/** A silhouette as the cluster reads it: 0 deep inside, 1 at its edge
 * and more past it. An organic shape is fitted to the box round its
 * middle, or the blob's when it bleeds, so it runs off that edge; its
 * cells and a field's are full grown DEPTH pitches in, or at a field's
 * own depth. */
function depthOf(silhouette: Exclude<Silhouette, 'blob'>, { w, h, pitch, seed, bleed, cx }: { w: number; h: number; pitch: number; seed: number; bleed: 'l' | 'r' | null; cx: number }) {
  if (typeof silhouette === 'object' && 'field' in silhouette) {
    const { field, depth = pitch * DEPTH } = silhouette
    return (x: number, y: number) => Math.max(0, 1 + field(x, y) / depth)
  }
  const [kind, limbs] = typeof silhouette === 'string' ? [silhouette, undefined] : [silhouette.kind, silhouette.limbs]
  const sdf = organic(kind, seed, limbs)
  // fitted to the box, stretched a little wider at most, round the box's
  // middle, or the blob's when it leans toward a bleeding edge
  const [x0, y0, x1, y1] = bounds(sdf)
  let sy = (h * 0.96) / (y1 - y0)
  const sx = Math.min((w * 0.96) / (x1 - x0), sy * 1.25)
  sy = Math.min(sy, sx)
  const [mx, my] = [bleed ? cx : w / 2, h / 2]
  const [ux, uy] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const depth = (pitch * DEPTH) / sy
  return (x: number, y: number) => Math.max(0, 1 + sdf([(x - mx) / sx + ux, (y - my) / sy + uy]) / depth)
}

/** How deep in a silhouette its cells reach their full size, in pitches:
 * a cell grows only as deep as it stands, so a thin limb holds small ones. */
const DEPTH = 2

/** An organic shape's bounds, sampled. */
function bounds(sdf: (p: [number, number]) => number) {
  const b = [Infinity, Infinity, -Infinity, -Infinity]
  for (let i = 0; i <= 80; i++) {
    for (let j = 0; j <= 80; j++) {
      const [u, v] = [-2.5 + (i / 80) * 5, -2.5 + (j / 80) * 5]
      if (sdf([u, v]) < 0) {
        b[0] = Math.min(b[0], u)
        b[1] = Math.min(b[1], v)
        b[2] = Math.max(b[2], u)
        b[3] = Math.max(b[3], v)
      }
    }
  }
  return b
}

/** Whether a polygon reads as a cell: round enough for its size, its area
 * against its perimeter, and no corner sharper than 50°, never a spike. */
function cellLike(poly: Point[]) {
  let area = 0
  let perim = 0
  poly.forEach((p, k) => {
    const q = poly[(k + 1) % poly.length]
    area += p[0] * q[1] - q[0] * p[1]
    perim += Math.hypot(q[0] - p[0], q[1] - p[1])
  })
  if ((4 * Math.PI * Math.abs(area / 2)) / (perim * perim) < 0.62) {
    return false
  }
  return !poly.some((p, k) => {
    const q = poly[(k - 1 + poly.length) % poly.length]
    const r = poly[(k + 1) % poly.length]
    const [ax, ay, bx, by] = [q[0] - p[0], q[1] - p[1], r[0] - p[0], r[1] - p[1]]
    const [la, lb] = [Math.hypot(ax, ay), Math.hypot(bx, by)]
    if (la < 1 || lb < 1) {
      return false
    }
    return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) < (50 * Math.PI) / 180
  })
}

/** A lone cell, as the mark draws one, in a 100 square: a marker's path. */
export function cell(seed: number): string {
  const rand = rng(seed)
  const k = 5 + Math.floor(rand() * 2)
  const pts: Point[] = Array.from({ length: k }, (_, i) => {
    const a = (i / k) * Math.PI * 2 + rand() * 0.6
    const r = 36 + rand() * 12
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]
  })
  return roundedPath(pts, 10, f)
}
