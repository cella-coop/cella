// Where a photo's interest lies (index.md, figures): a small grid, 0 to 1,
// high on its faces, its people and its detail, low on plain background,
// that a figure's cluster grows its large cells on. No model, only the
// photo: the energy of its edges, its local contrast and how like skin
// its colour is, weighed toward its middle, blurred and normalised. It is
// computed once, at build, and cached as the engravings are.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { sample, type Field, type Grid } from '@cella/brand'
import { ratio } from './engrave'

/** The grid's width, in cells; its height follows the photo's ratio. */
const SIZE = 64
// The photo is read at four times the grid, so an edge is a few pixels
const READ = SIZE * 4

const CACHE = join(process.cwd(), '.astro/interest')
// A change to how interest is measured bumps it, so no stale grid is reused
const VERSION = 1

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
  for (let i = 0; i < w * h; i++) {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = y / 255
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
  const [edges, skins] = await Promise.all([blur(edge, w, h, sigma), blur(skin, w, h, sigma)])
  const [e, c, s] = [normal(edges), normal(contrast), normal(skins)]
  const raw = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [u, v] = [(x / w - 0.5) * 2, (y / h - 0.5) * 2]
      const centre = Math.exp(-(u * u + v * v) / (2 * 0.6 * 0.6))
      const i = y * w + x
      raw[i] = (0.4 * e[i] + 0.25 * c[i] + 0.6 * s[i]) * (0.45 + 0.55 * centre)
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

/** A photo's interest at each point of a figure's box, w by h, that the
 * photo covers as the figure lays it, centred and cut to fill. */
export async function interestIn(name: string, w: number, h: number): Promise<Field> {
  const r = await ratio(name)
  const tall = Math.max(h, w / r)
  return sample(await interest(name), { x: (w - tall * r) / 2, y: (h - tall) / 2, w: tall * r, h: tall })
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
