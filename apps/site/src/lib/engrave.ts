// A photo as a line engraving (index.md, figures): rippled horizontal
// lines swelling with the tone, a hairline even in the lights, as a burin
// leaves, and a crossing hatch in the deepest shadows. It is cut once, at
// build, into a mask whose alpha is the ink's coverage, and served as its
// own file by `pages/engraving/[key].png.ts`; the page colours it, so a
// change of ink is CSS.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { photoNames } from './assets'

/** The width an engraving is cut at, in pixels: sharp on a wide screen's
 * figure at twice its density, light enough for a phone. */
export const WIDTH = 1600

// The pattern is drawn for a 1100 pixel cut and scales with it: the lines'
// pitch, the ripple and the blur, so a sharper cut changes only density
const BASE = 1100
const PITCH = 3.5

const file = (name: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), 'src/photos', `${name}.jpg`)
}

export const engravingUrl = (name: string) => `/engraving/${name}-${WIDTH}.png`

export const engravingKeys = () => photoNames().map((name) => ({ name, width: WIDTH }))

const CACHE = join(process.cwd(), '.astro/engraving')
// A change to how an engraving is cut bumps it, so no stale one is reused
const VERSION = 1

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export async function engrave(name: string, width: number) {
  const cached = join(CACHE, `${name}-${width}-${statSync(file(name)).mtimeMs}-${VERSION}.png`)
  if (existsSync(cached)) {
    return readFileSync(cached)
  }
  const s = width / BASE
  const pitch = PITCH * s
  const { data, info } = await sharp(readFileSync(file(name)))
    .resize({ width })
    .grayscale()
    .normalise({ lower: 2, upper: 98 })
    .blur(0.8 * s)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const px = Buffer.alloc(w * h * 2)
  // a line's coverage at a position across it: a cut of half-width `half`
  // of the pitch, its edge a pixel soft
  const line = (pos: number, half: number) => {
    const d = Math.abs((((pos / pitch) % 1) + 1) % 1 - 0.5) * 2
    return clamp((half - (1 - d)) / (1.1 / pitch) + 0.5)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dark = 1 - data[y * w + x] / 255
      const half = 0.17 + Math.pow(clamp((dark - 0.18) / 0.82), 1.25) * 0.8
      const yy = y + 1.6 * s * Math.sin(x / (23 * s) + y / (61 * s))
      let a = line(yy, half)
      const deep = clamp((dark - 0.62) / 0.38)
      if (deep > 0) {
        a = Math.max(a, line(x * 0.8 + y * 0.6, deep * 0.55))
      }
      px[(y * w + x) * 2] = 255
      px[(y * w + x) * 2 + 1] = Math.round(a * 255)
    }
  }
  const png = await sharp(px, { raw: { width: w, height: h, channels: 2 } }).png({ palette: true, colours: 8, compressionLevel: 9 }).toBuffer()
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, png)
  return png
}

/** A photo's width over its height. */
export async function ratio(name: string) {
  const { width = 3, height = 2 } = await sharp(file(name)).metadata()
  return width / height
}
