// A cluster's silhouettes: the shapes its cells fill. Each is a signed
// distance in the box's units, negative inside, so the cluster reads how
// deep a seed stands in it, and sizes and keeps its cells by that, while
// the cells stay its own. The organic shapes are built from circles and
// tapering limbs melted together; a mask, a picture's or an icon's, comes
// in as a grid, its distance computed here.

import { rng } from './mark.ts'

export type Field = (x: number, y: number) => number

/** A grid of values, row by row, w by h. */
export type Grid = { w: number; h: number; data: ArrayLike<number> }

/** Where a grid lies in the box: its corner and its size. */
export type Place = { x: number; y: number; w: number; h: number }

/** The organic silhouettes by name, and how many limbs each grows. */
export type Organic = 'amoeba' | 'branch' | 'bubbles' | 'colony'

export const ORGANIC: readonly Organic[] = ['amoeba', 'branch', 'bubbles', 'colony']

type V = [number, number]

const len = (x: number, y: number) => Math.hypot(x, y)

/** A smooth union: two shapes melted together over a width k. */
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

const circle = (c: V, r: number) => (p: V) => len(p[0] - c[0], p[1] - c[1]) - r

/** A limb from a to b, its radius tapering from ra to rb. */
const limb = (a: V, b: V, ra: number, rb: number) => (p: V) => {
  const [bx, by] = [b[0] - a[0], b[1] - a[1]]
  const [px, py] = [p[0] - a[0], p[1] - a[1]]
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)))
  return len(px - bx * t, py - by * t) - (ra + (rb - ra) * t)
}

const at = (r: number, a: number): V => [r * Math.cos(a), r * Math.sin(a)]

const melt = (parts: ((p: V) => number)[], k: number) => (p: V) => parts.reduce((d, s) => smin(d, s(p), k), Infinity)

/** Angles round a circle, n of them, spread evenly and jittered. */
const spread = (n: number, rand: () => number, jitter = 0.5) => {
  const a0 = rand() * Math.PI * 2
  return Array.from({ length: n }, (_, i) => a0 + ((i + (rand() - 0.5) * jitter) / n) * Math.PI * 2)
}

/** An organic shape in units of the box's half-height, round the origin,
 * its limbs as many as `n`, or its own count when unset. */
export function organic(kind: Organic, seed: number, n?: number): (p: V) => number {
  const rand = rng(seed * 13 + 5)
  if (kind === 'amoeba') {
    // a wobbling body putting out pseudopods, thick at the root
    const [a, b] = [rand() * 6.3, rand() * 6.3]
    const body = (p: V) => {
      const t = Math.atan2(p[1], p[0])
      return len(p[0], p[1]) - 0.6 * (1 + 0.08 * Math.sin(3 * t + a) + 0.05 * Math.sin(5 * t + b))
    }
    const pods = spread(n ?? 4, rand).map((t) => {
      const reach = 0.9 + rand() * 0.35
      const bend = (rand() - 0.5) * 0.7
      const mid = at(reach * 0.6, t + bend * 0.5)
      return melt([limb(at(0.3, t), mid, 0.3, 0.22), limb(mid, at(reach, t + bend), 0.22, 0.15)], 0.08)
    })
    return melt([body, ...pods], 0.22)
  }
  if (kind === 'branch') {
    // a small core and limbs that fork once, tapering to their twigs
    const parts: ((p: V) => number)[] = [circle([0, 0], 0.38)]
    for (const t of spread(n ?? 3, rand, 0.35)) {
      const reach = 0.6 + rand() * 0.2
      const end = at(reach, t)
      parts.push(limb([0, 0], end, 0.25, 0.19))
      for (const side of [-1, 1]) {
        const turn = t + side * (0.45 + rand() * 0.3)
        const tip = at(0.3 + rand() * 0.15, turn)
        parts.push(limb(end, [end[0] + tip[0], end[1] + tip[1]], 0.17, 0.12))
      }
    }
    return melt(parts, 0.12)
  }
  if (kind === 'bubbles') {
    // a main mass of two melted circles, and bubbles standing off it
    const lean = rand() * 6.3
    const main = melt([circle([0, 0], 0.6), circle(at(0.32, lean), 0.42)], 0.25)
    const bubbles = spread(n ?? 6, rand, 0.7).map((t) => {
      const r = 0.1 + rand() * 0.14
      return circle(at(0.66 + 0.06 + rand() * 0.08 + r, t), r)
    })
    return (p: V) => bubbles.reduce((d, s) => Math.min(d, s(p)), main(p))
  }
  // a colony: lobes budding one off another, melted into one mass
  const lobes: V[] = [[0, 0]]
  const radii = [0.42]
  for (let i = 1; i < (n ?? 7); i++) {
    const from = Math.floor(rand() * lobes.length)
    const r = 0.24 + rand() * 0.16
    const t = rand() * Math.PI * 2
    const c = lobes[from]
    lobes.push([c[0] + Math.cos(t) * (radii[from] + r) * 0.75, c[1] + Math.sin(t) * (radii[from] + r) * 0.75])
    radii.push(r)
  }
  // centred on its lobes' middle
  const [mx, my] = [lobes.reduce((s, c) => s + c[0], 0) / lobes.length, lobes.reduce((s, c) => s + c[1], 0) / lobes.length]
  return melt(lobes.map((c, i) => circle([c[0] - mx, c[1] - my], radii[i])), 0.14)
}

/** A grid's value at a point of the box, bilinear between its cells, the
 * nearest edge's beyond it. */
export function sample(grid: Grid, place: Place): Field {
  const { w, h, data } = grid
  return (x, y) => {
    const gx = Math.max(0, Math.min(w - 1, ((x - place.x) / place.w) * w - 0.5))
    const gy = Math.max(0, Math.min(h - 1, ((y - place.y) / place.h) * h - 0.5))
    const [x0, y0] = [Math.floor(gx), Math.floor(gy)]
    const [x1, y1] = [Math.min(w - 1, x0 + 1), Math.min(h - 1, y0 + 1)]
    const [fx, fy] = [gx - x0, gy - y0]
    const v = (i: number, j: number) => data[j * w + i]
    return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy
  }
}

/** A mask's signed distance, in the box's units: a grid whose values
 * over a half are inside, laid at a place. Beyond the grid, the distance
 * to it is added to its edge's. */
export function maskField(mask: Grid, place: Place): Field {
  const { w, h, data } = mask
  const inside = Array.from({ length: w * h }, (_, i) => data[i] > 0.5)
  const away = edt(inside, w, h, false)
  const into = edt(inside, w, h, true)
  const unit = place.w / w
  const signed = Float64Array.from(inside, (v, i) => (v ? -(into[i] - 0.5) : away[i] - 0.5) * unit)
  const near = sample({ w, h, data: signed }, place)
  return (x, y) => {
    const dx = Math.max(place.x - x, 0, x - place.x - place.w)
    const dy = Math.max(place.y - y, 0, y - place.y - place.h)
    return near(x, y) + len(dx, dy)
  }
}

/** Each cell's distance to the nearest cell of the other kind, in cells:
 * two passes of the 8SSEDT sweep, each cell carrying its nearest's
 * offset. */
function edt(inside: boolean[], w: number, h: number, of: boolean): Float64Array {
  const far = 1e6
  const ox = new Float64Array(w * h)
  const oy = new Float64Array(w * h)
  inside.forEach((v, i) => {
    const target = v !== of
    ox[i] = target ? 0 : far
    oy[i] = target ? 0 : far
  })
  const look = (i: number, x: number, y: number, dx: number, dy: number) => {
    const [nx, ny] = [x + dx, y + dy]
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      return
    }
    const j = ny * w + nx
    const [cx, cy] = [ox[j] + Math.abs(dx), oy[j] + Math.abs(dy)]
    if (cx * cx + cy * cy < ox[i] * ox[i] + oy[i] * oy[i]) {
      ox[i] = cx
      oy[i] = cy
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      look(y * w + x, x, y, -1, 0)
      look(y * w + x, x, y, 0, -1)
      look(y * w + x, x, y, -1, -1)
      look(y * w + x, x, y, 1, -1)
    }
    for (let x = w - 1; x >= 0; x--) {
      look(y * w + x, x, y, 1, 0)
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      look(y * w + x, x, y, 1, 0)
      look(y * w + x, x, y, 0, 1)
      look(y * w + x, x, y, 1, 1)
      look(y * w + x, x, y, -1, 1)
    }
    for (let x = 0; x < w; x++) {
      look(y * w + x, x, y, -1, 0)
    }
  }
  return Float64Array.from(ox, (x, i) => Math.hypot(x, oy[i]))
}
