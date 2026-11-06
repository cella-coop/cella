// The mark, the explorer's markSvg() ported: five cells, as under a
// microscope, round a blank centre, each the true Voronoi cell of its
// seed among seeds no one sees, shrunk by half the gutter and rounded at
// its corners, in the five inks. The pinwheel and the strip are the
// explorer's other styles, kept so house.json may name them.

import type { Mark } from './house.ts'

type Point = [number, number]

/** The explorer's seeded random sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The part of a convex polygon on the near side of a line through
    (px, py) with normal (nx, ny). */
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
function roundedPath(poly: Point[], rad: number, f: (v: number) => string): string {
  const n = poly.length
  let d = ''
  for (let k = 0; k < n; k++) {
    const p = poly[k]
    const a = poly[(k - 1 + n) % n]
    const b = poly[(k + 1) % n]
    const la = Math.hypot(a[0] - p[0], a[1] - p[1])
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1])
    const r = Math.min(rad, la / 2, lb / 2)
    const p1 = [p[0] + ((a[0] - p[0]) / la) * r, p[1] + ((a[1] - p[1]) / la) * r]
    const p2 = [p[0] + ((b[0] - p[0]) / lb) * r, p[1] + ((b[1] - p[1]) / lb) * r]
    d += `${k === 0 ? 'M' : 'L'}${f(p1[0])} ${f(p1[1])}Q${f(p[0])} ${f(p[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return `${d}Z`
}

type Seed = { p: Point; kind: 'empty' | 'ink' | 'hidden'; i?: number; w?: number }

function voronoiCells(m: Mark, gut: number, ink: (i: number) => string, f: (v: number) => string, bb: number[]): string {
  const rand = rng(1000 + (m.seed ?? 7))
  const j = m.jitter ?? 0.35
  const r1 = m.spread * 1.4
  const r2 = r1 * 1.85
  const r3 = r1 * 2.7
  const step = (n: number) => 360 / n
  const seed = (rad: number, deg: number, spread: number): Point => {
    const a = ((deg + (rand() - 0.5) * spread * j) * Math.PI) / 180
    const rr = rad * (1 + (rand() - 0.5) * 0.35 * j)
    return [50 + rr * Math.cos(a), 50 + rr * Math.sin(a)]
  }
  /* the blank centre carries a weight, as in a power diagram: its
     boundary with each neighbour moves out or in while the five keep
     their places */
  const seeds: Seed[] = [{ p: [50 + (rand() - 0.5) * r1 * 0.3 * j, 50 + (rand() - 0.5) * r1 * 0.3 * j], kind: 'empty', w: (m.core ?? 0) * r1 * r1 * 0.9 }]
  for (let i = 0; i < 5; i++) {
    seeds.push({ p: seed(r1, -90 + m.rot + i * 72, 40), kind: 'ink', i })
  }
  const n2 = Math.round(m.cells ?? 11)
  for (let i = 0; i < n2; i++) {
    seeds.push({ p: seed(r2, -90 + m.rot + (i + 0.5) * step(n2), step(n2) * 0.8), kind: 'empty' })
  }
  const n3 = n2 + 6
  for (let i = 0; i < n3; i++) {
    seeds.push({ p: seed(r3, -90 + m.rot + i * step(n3), step(n3) * 0.8), kind: 'hidden' })
  }
  const box: Point[] = [[-80, -80], [180, -80], [180, 180], [-80, 180]]
  const inset = gut / 2
  let body = ''
  seeds.forEach((s, a) => {
    /* only the five are drawn; the rest are seeds alone, shaping them */
    if (s.kind !== 'ink') {
      return
    }
    let poly = box
    seeds.forEach((t, b) => {
      if (a === b || poly.length < 3) {
        return
      }
      const dx = t.p[0] - s.p[0]
      const dy = t.p[1] - s.p[1]
      const d = Math.hypot(dx, dy)
      const nx = dx / d
      const ny = dy / d
      const shift = ((s.w ?? 0) - (t.w ?? 0)) / (2 * d) - inset
      poly = clipHalf(poly, (s.p[0] + t.p[0]) / 2 + nx * shift, (s.p[1] + t.p[1]) / 2 + ny * shift, nx, ny)
    })
    if (poly.length < 3) {
      return
    }
    poly.forEach(([x, y]) => {
      bb[0] = Math.min(bb[0], x)
      bb[1] = Math.min(bb[1], y)
      bb[2] = Math.max(bb[2], x)
      bb[3] = Math.max(bb[3], y)
    })
    body += `<path d="${roundedPath(poly, m.round ?? 3, f)}" fill="${ink(s.i ?? 0)}"/>`
  })
  return body
}

/** The mark as the explorer draws it at a size, in the five hues, its
    masks named from id. */
export function markSvg(m: Mark, hues: number[], size: number, id = 'mk1', cls = ''): string {
  const ink = (i: number) => `oklch(${m.l} ${m.c} ${hues[i]})`
  const pts: Point[] = [0, 1, 2, 3, 4].map((i) => {
    const a = ((-90 + m.rot + i * 72) * Math.PI) / 180
    return [50 + m.spread * Math.cos(a), 50 + m.spread * Math.sin(a)]
  })
  const f = (v: number) => v.toFixed(2)
  /* the box is the figure's own, with a hair of margin */
  const half = m.style === 'voronoi' ? m.spread * 1.4 * 2.45 + 2 : m.style === 'strip' ? 50 : m.spread + m.r + 1
  let vb = [50 - half, 50 - half, 2 * half]
  /* the gutter keeps at least 0.9 px at any size */
  const gut = m.gutter > 0 ? Math.max(m.gutter, (0.9 * 2 * half) / size) : 0
  const box = `x="${f(50 - half)}" y="${f(50 - half)}" width="${f(2 * half)}" height="${f(2 * half)}"`
  const mask = (n: number, inner: string) => `<mask id="${id}-${n}" maskUnits="userSpaceOnUse" ${box}><rect ${box} fill="white"/>${inner}</mask>`
  let defs = ''
  let body = ''
  if (m.style === 'strip') {
    /* five bands in a parallelogram leaning by the slant */
    const H = 64
    const top = 50 - H / 2
    const sk = Math.min(40, H * Math.tan((m.slant * Math.PI) / 180))
    const xl = (y: number) => 50 - half * 0.82 + sk * ((top + H - y) / H)
    const xr = (y: number) => 50 + half * 0.82 - sk * ((y - top) / H)
    const g = (H * m.bandGap) / 4
    const bh = (H - 4 * g) / 5
    body = [0, 1, 2, 3, 4].map((i) => {
      const y0 = top + i * (bh + g)
      const y1 = y0 + bh
      return `<polygon points="${f(xl(y0))},${f(y0)} ${f(xr(y0))},${f(y0)} ${f(xr(y1))},${f(y1)} ${f(xl(y1))},${f(y1)}" fill="${ink(i)}"/>`
    }).join('')
  } else if (m.style === 'voronoi') {
    const bb = [Infinity, Infinity, -Infinity, -Infinity]
    body = voronoiCells(m, gut, ink, f, bb)
    if (bb[0] < bb[2]) {
      const side = Math.max(bb[2] - bb[0], bb[3] - bb[1]) + 2
      vb = [(bb[0] + bb[2]) / 2 - side / 2, (bb[1] + bb[3]) / 2 - side / 2, side]
    }
  } else {
    /* the pinwheel: each disc cut by the one before it, all the way round */
    pts.forEach(([x, y], i) => {
      const [cx, cy] = pts[(i + 4) % 5]
      defs += mask(i, `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(m.r + gut)}" fill="black"/>`)
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(m.r)}" fill="${ink(i)}" mask="url(#${id}-${i})"/>`
    })
  }
  return `<svg class="${cls}" viewBox="${f(vb[0])} ${f(vb[1])} ${f(vb[2])} ${f(vb[2])}" width="${f(size)}" height="${f(size)}" role="img" aria-label="Cella"><defs>${defs}</defs>${body}</svg>`
}

/** The mark's box at a size, as markSvg draws it: its viewBox. */
export function markBox(svg: string): number[] {
  const m = svg.match(/viewBox="([^"]+)"/)
  return m ? m[1].split(' ').map(Number) : [0, 0, 100, 100]
}
