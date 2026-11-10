// Where a photo's interest lies (index.md, figures): a small grid, 0 to 1,
// high on its skin and its detail, low on plain background, whose peaks
// are a photo's focus where no face or person is found in it. No model,
// only the photo: the energy of its edges, its local contrast and how
// like skin its colour is, weighed toward its middle, blurred and
// normalised. It is computed once, at build, and cached as the
// engravings are.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import type { Grid } from '@cella/brand'

/** The grid's width, in cells; its height follows the photo's ratio. */
const SIZE = 64
// The photo is read at four times the grid, so an edge is a few pixels
const READ = SIZE * 4

const CACHE = join(process.cwd(), '.astro/interest')
// A change to how interest is measured bumps it, so no stale grid, nor
// focus found from one, is reused
export const VERSION = 5

// How much a colour apart from the photo's own counts, against its edges
const DISTINCT = 1

const file = (name: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), 'src/photos', `${name}.jpg`)
}

export async function interest(name: string): Promise<Grid> {
  const cached = join(CACHE, `${name}-${statSync(file(name)).mtimeMs}-${VERSION}.json`)
  if (existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8')) as Grid
  }
  const { data, info } = await sharp(readFileSync(file(name))).resize({ width: READ }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const lum = new Float32Array(w * h)
  const skin = new Float32Array(w * h)
  const lab = new Float32Array(w * h * 3)
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = y / 255
    lab.set(cielab(r, g, b), i * 3)
    // skin sits in a narrow band of chroma whatever its tone: a soft
    // likelihood round its middle, in YCbCr, but never in the deep shadows
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    skin[i] = Math.exp(-(((cb - 108) / 14) ** 2 + ((cr - 150) / 11) ** 2) / 2) * Math.min(1, y / 60)
  }
  // edge energy: the gradient's size, by Sobel
  const edge = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const at = (dx: number, dy: number) => lum[(y + dy) * w + x + dx]
      const gx = at(1, -1) + 2 * at(1, 0) + at(1, 1) - at(-1, -1) - 2 * at(-1, 0) - at(-1, 1)
      const gy = at(-1, 1) + 2 * at(0, 1) + at(1, 1) - at(-1, -1) - 2 * at(0, -1) - at(1, -1)
      edge[y * w + x] = Math.hypot(gx, gy)
    }
  }
  // local contrast: the spread of the tone round each pixel
  const sigma = w / 40
  const [mean, square] = await Promise.all([blur(lum, w, h, sigma), blur(lum.map((v) => v * v), w, h, sigma)])
  const contrast = mean.map((m, i) => Math.sqrt(Math.max(0, square[i] - m * m)))
  // distinctness: how far each pixel's colour stands from the photo's
  // mean, in CIELAB, so a figure stands out from the ground it is set on
  // whatever its texture (Achanta's frequency-tuned saliency)
  const avg = [0, 1, 2].map((k) => lab.reduce((s, v, i) => (i % 3 === k ? s + v : s), 0) / (w * h))
  const apart = Float32Array.from({ length: w * h }, (_, i) => Math.hypot(lab[i * 3] - avg[0], lab[i * 3 + 1] - avg[1], lab[i * 3 + 2] - avg[2]))
  const [edges, skins, distinct] = await Promise.all([blur(edge, w, h, sigma), blur(skin, w, h, sigma), blur(apart, w, h, sigma)])
  const [e, c, s, d] = [normal(edges), normal(contrast), normal(skins), normal(distinct)]
  const raw = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [u, v] = [(x / w - 0.5) * 2, (y / h - 0.5) * 2]
      const centre = Math.exp(-(u * u + v * v) / (2 * 0.6 * 0.6))
      const i = y * w + x
      raw[i] = (0.4 * e[i] + 0.25 * c[i] + 0.6 * s[i] + DISTINCT * d[i]) * (0.45 + 0.55 * centre)
    }
  }
  // blurred broad, so a region reads, not a pixel, then down to the grid
  const broad = normal(await blur(raw, w, h, w / 16))
  const gh = Math.round((SIZE * h) / w)
  const grid: number[] = []
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < SIZE; i++) {
      const [x, y] = [Math.floor(((i + 0.5) * w) / SIZE), Math.floor(((j + 0.5) * h) / gh)]
      grid.push(Math.round(broad[y * w + x] * 1000) / 1000)
    }
  }
  const out: Grid = { w: SIZE, h: gh, data: grid }
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, JSON.stringify(out))
  return out
}

/** A field blurred by sharp, a Gaussian of sigma pixels, kept in 0 to 1. */
async function blur(field: Float32Array, w: number, h: number, sigma: number) {
  const top = field.reduce((m, v) => Math.max(m, v), 1e-6)
  const bytes = Uint8Array.from(field, (v) => Math.round((v / top) * 255))
  const out = await sharp(bytes, { raw: { width: w, height: h, channels: 1 } }).blur(sigma).toColourspace('b-w').raw().toBuffer()
  return Float32Array.from(out, (v) => (v / 255) * top)
}

/** A field stretched to 0 to 1 between its 2nd and 98th percentiles. */
function normal(field: Float32Array) {
  const sorted = Float32Array.from(field).sort()
  const [lo, hi] = [sorted[Math.floor(sorted.length * 0.02)], sorted[Math.floor(sorted.length * 0.98)]]
  const span = Math.max(hi - lo, 1e-6)
  return field.map((v) => Math.max(0, Math.min(1, (v - lo) / span)))
}

/** A colour in CIELAB, from sRGB 0 to 255, under D65. */
function cielab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)]
  const x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047
  const y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  const z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
