// A photo as a line engraving (index.md, figures): rippled horizontal
// lines swelling with the tone, a hairline even in the lights, as a burin
// leaves, and never quite meeting in the shadows. It is cut once, at
// build, into a mask whose alpha is the ink's coverage, and served as its
// own file by `pages/engraving/[key].png.ts`; the page colours it, so a
// change of ink is CSS.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { photoNames } from './assets'

/** The width an engraving is cut at, in pixels: sharp on a wide screen's
 * figure at twice its density, light enough for a phone. */
export const WIDTH = 1600

// The pattern is drawn for a 1100 pixel cut and scales with it: the lines'
// pitch, the ripple and the blur, so a sharper cut changes only density.
// The browser shrinks a mask by sampling it, not averaging it, so a line
// pattern near its pixel pitch beats into moiré: the pitch keeps a line
// over four pixels on a desktop figure, a line never swells past most of
// it, leaving a gap the shrink still catches, and its edge is soft over a
// third of it, a profile with little above its own frequency to alias
const BASE = 1100
const PITCH = 5.5
const SWELL = 0.86
const SOFT = 0.3

// A portrait, a person's own picture in `src/people/`, is shown small, in
// a single cell, so it is cut square and coarser for its size: its lines
// as far apart on the page as a figure's, some forty across a face
export const PORTRAIT = 480
const PORTRAIT_BASE = 220

type Kind = 'photo' | 'person'
const DIRS: Record<Kind, string> = { photo: 'src/photos', person: 'src/people' }

const file = (name: string, kind: Kind = 'photo') => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), DIRS[kind], `${name}.jpg`)
}

export const engravingUrl = (name: string) => `/engraving/${name}-${WIDTH}.png`
export const portraitUrl = (name: string) => `/portrait/${name}-${PORTRAIT}.png`

export const engravingKeys = () => photoNames().map((name) => ({ name, width: WIDTH }))

/** Every person's picture in `src/people/`, by name. */
export function peopleNames(): string[] {
  try {
    return readdirSync(join(process.cwd(), DIRS.person))
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.slice(0, -4))
      .sort()
  } catch {
    return []
  }
}

const CACHE = join(process.cwd(), '.astro/engraving')
// A change to how an engraving is cut bumps it, so no stale one is reused
const VERSION = 2

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export async function engrave(name: string, width: number, kind: Kind = 'photo') {
  const cached = join(CACHE, `${kind}-${name}-${width}-${statSync(file(name, kind)).mtimeMs}-${VERSION}.png`)
  if (existsSync(cached)) {
    return readFileSync(cached)
  }
  const s = width / (kind === 'person' ? PORTRAIT_BASE : BASE)
  const pitch = PITCH * s
  const { data, info } = await sharp(readFileSync(file(name, kind)))
    .resize(kind === 'person' ? { width, height: width, fit: 'cover', position: 'attention' } : { width })
    .grayscale()
    .normalise({ lower: 2, upper: 98 })
    .blur(0.8 * s)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const px = Buffer.alloc(w * h * 2)
  // a line's coverage at a position across it: a cut covering `width` of
  // the pitch, its edge soft over SOFT of it
  const line = (pos: number, width: number) => {
    const d = Math.abs((((pos / pitch) % 1) + 1) % 1 - 0.5) * 2
    return clamp((width - (1 - d)) / SOFT + 0.5)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dark = 1 - data[y * w + x] / 255
      const width = 0.17 + Math.pow(clamp((dark - 0.18) / 0.82), 1.25) * (SWELL - 0.17)
      const yy = y + 1.6 * s * Math.sin(x / (23 * s) + y / (61 * s))
      px[(y * w + x) * 2] = 255
      px[(y * w + x) * 2 + 1] = Math.round(line(yy, width) * 255)
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
