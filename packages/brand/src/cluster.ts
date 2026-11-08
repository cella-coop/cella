// The brand's cells beyond the mark: a cluster of them that a picture is
// cut into, and a lone cell for a marker. A cluster is a power diagram, a
// Voronoi diagram whose seeds weigh their disk's area, so a big seed owns
// a big cell: the disks' radii follow a power law, a few large and a long
// tail of small, the large gathered in the middle, and the cluster's edge
// a lobed blob with a tail, never its box.

import { clipHalf, rng, roundedPath, type Point } from './mark.ts'

export type ClusterOptions = {
  /** The typical cell's size, in the box's units. */
  pitch: number
  /** The cut between two cells, at most. */
  gutter: number
  /** A corner's rounding, at most. */
  round: number
  seed: number
  /** The share of the rim's cells left out, so the edge breaks. */
  drop?: number
  /** A side the cluster runs off, past the box's edge. */
  bleed?: 'l' | 'r' | null
}

const f = (v: number) => v.toFixed(1)

/** How far a cell may reach from its seed, in its disk's radii, and the
 * sides of the polygon that bounds it. */
const REACH = 1.5
const REACH_SIDES = 14

/** A cluster's cells, as SVG paths, in a box w by h. */
export function cluster(w: number, h: number, { pitch, gutter, round, seed, drop = 0, bleed = null }: ClusterOptions): string[] {
  // The outline: a blob whose radius wobbles with the angle, and a lobe,
  // its tail. Bleeding off one side, its middle leans toward that edge and
  // its tail points back the other way, toward the words
  const shape = rng(seed * 7 + 3)
  const [a, b, c] = [shape() * 6.3, shape() * 6.3, shape() * 6.3]
  const lean = bleed === 'r' ? 0.14 : bleed === 'l' ? -0.14 : 0
  const [cx, cy] = [w * (0.5 + lean) + (shape() - 0.5) * w * 0.06, h / 2 + (shape() - 0.5) * h * 0.08]
  const tail = bleed === 'r' ? Math.PI + (shape() - 0.5) * 1.4 : bleed === 'l' ? (shape() - 0.5) * 1.4 : shape() * 6.3
  const outline = (x: number, y: number) => {
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

  // The seeds: disks whose radii follow a power law, packed biggest first
  // at random spots without overlapping, over the box and a margin round
  // it. How big a disk may be falls off from the middle, so the big cells
  // gather there and the rim and the tail break into ever smaller ones
  const rand = rng(seed)
  const [rmin, rmax, alpha] = [pitch * 0.2, pitch * 1.3, 1.5]
  const cap = (x: number, y: number) => rmax * Math.max(0.12, 1.05 - outline(x, y) * 0.85) ** 1.6
  const radii = Array.from({ length: 1400 }, () => Math.min(rmax, rmin * (1 - rand()) ** (-1 / alpha))).sort((p, q) => q - p)
  const margin = rmax
  const disks: { x: number; y: number; r: number }[] = []
  const sep = (r1: number, r2: number) => Math.min(gutter, 0.18 * Math.min(r1, r2)) * 0.4
  for (const r of radii) {
    for (let tries = 0; tries < 50; tries++) {
      const x = -margin + rand() * (w + margin * 2)
      const y = -margin + rand() * (h + margin * 2)
      if (r > Math.max(rmin, cap(x, y))) {
        continue
      }
      if (disks.every((d) => Math.hypot(d.x - x, d.y - y) >= d.r + r + sep(d.r, r))) {
        disks.push({ x, y, r })
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
      if (i === j || d > rmax * 4) {
        continue
      }
      const [nx, ny] = [(t.x - s.x) / d, (t.y - s.y) / d]
      // the power bisector: where the two weighted distances meet, nearer
      // the lighter seed; the gutter is the smaller cell's share, so a
      // small cell is never swallowed by it
      const g = Math.min(gutter, 0.18 * Math.min(s.r, t.r))
      const at = (d * d + s.r * s.r - t.r * t.r) / (2 * d) - g / 2
      poly = clipHalf(poly, s.x + nx * at, s.y + ny * at, nx, ny)
    }
    // and no further from its seed than a reach of its disk, so a cell on
    // the rim, with no neighbour beyond it, rounds off instead of running
    // out to a spike
    for (let k = 0; k < REACH_SIDES && poly.length >= 3; k++) {
      const [nx, ny] = [Math.cos((k / REACH_SIDES) * Math.PI * 2), Math.sin((k / REACH_SIDES) * Math.PI * 2)]
      poly = clipHalf(poly, s.x + nx * s.r * REACH, s.y + ny * s.r * REACH, nx, ny)
    }
    // wholly inside the box, but on a bleeding side it may run off the edge
    const inside = poly.length >= 3 && poly.every(([x, y]) => (bleed === 'l' || x >= 2) && (bleed === 'r' || x <= w - 2) && y >= 2 && y <= h - 2)
    if (!inside || !cellLike(poly)) {
      return
    }
    // inside the outline, or a loose cell past it, the smaller the likelier
    const at = outline(s.x, s.y)
    const small = s.r < rmin * 1.6
    const loose = at >= 1 && at < (small ? 1.45 : 1.15) && rand() < (small ? 0.45 : 0.15)
    if ((at >= 1 && !loose) || (at < 1 && at > 0.9 && rand() < drop)) {
      return
    }
    paths.push(roundedPath(poly, Math.min(round, 0.3 * s.r), f))
  })
  return paths
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
