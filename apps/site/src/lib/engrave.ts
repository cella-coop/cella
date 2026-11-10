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
// a single cell, so it is cut square, its lines closer than a figure's.
// A face lives in its mid-tones, which a levelled photo crushes, so a
// portrait's contrast is evened out locally first, its mid-tones lifted
// and its lightest third left to the hairlines: features stand out of
// skin and beard alike
export const PORTRAIT = 480
const PORTRAIT_BASE = 500
const FACE = { clahe: 48, gamma: 1.8, light: 0.28 }

// A cover, a post's photo shown as a hint on the blog's index, is a
// photo engraved small: its lines drawn for its own size, as a portrait's
// are, so they stay lines at a thumbnail's size and never beat into moiré
export const COVER = 600
const COVER_BASE = 560

type Kind = 'photo' | 'person' | 'cover'
const DIRS: Record<Kind, string> = { photo: 'src/photos', person: 'src/people', cover: 'src/photos' }

// A photo whose subject lives in its mid-tones, as an aerial forest or an
// abstract does, engraves as even stripes; its sidecar may ask for a
// portrait's treatment, `tone`: its contrast evened out locally over
// tiles of `clahe` pixels, its mid-tones lifted by `gamma`, its lines
// swelling only from `light`. Unset, a photo is only levelled
type Tone = { clahe?: number; gamma?: number; light?: number }
function toneOf(name: string, kind: Kind): Tone {
  if (kind === 'person') {
    return FACE
  }
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), DIRS.photo, `${name}.json`), 'utf8')) as { tone?: Tone }).tone ?? {}
  } catch {
    return {}
  }
}

const file = (name: string, kind: Kind = 'photo') => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), DIRS[kind], `${name}.jpg`)
}

// the version in the address, so a browser never shows a stale cut
export const engravingUrl = (name: string) => `/engraving/${name}-${WIDTH}.png?v=${VERSION}`
export const portraitUrl = (name: string) => `/portrait/${name}-${PORTRAIT}.png?v=${VERSION}`
export const coverUrl = (name: string) => `/cover/${name}-${COVER}.png?v=${VERSION}`

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
const VERSION = 4

const clamp = (v: number) => Math.max(0, Math.min(1, v))

export async function engrave(name: string, width: number, kind: Kind = 'photo') {
  const tone = toneOf(name, kind)
  const toned = [tone.clahe, tone.gamma, tone.light].join('_')
  const cached = join(CACHE, `${kind}-${name}-${width}-${statSync(file(name, kind)).mtimeMs}-${toned}-${VERSION}.png`)
  if (existsSync(cached)) {
    return readFileSync(cached)
  }
  const face = kind === 'person'
  const s = width / (face ? PORTRAIT_BASE : kind === 'cover' ? COVER_BASE : BASE)
  const pitch = PITCH * s
  let picture = sharp(readFileSync(file(name, kind)))
    .resize(face ? { width, height: width, fit: 'cover', position: 'attention' } : { width })
    .grayscale()
  if (tone.clahe) {
    picture = picture.clahe({ width: tone.clahe, height: tone.clahe, maxSlope: 3 })
  }
  picture = picture.normalise({ lower: 2, upper: 98 })
  if (tone.gamma) {
    picture = picture.gamma(tone.gamma)
  }
  const { data, info } = await picture.blur(0.8 * s).raw().toBuffer({ resolveWithObject: true })
  // where the lines begin to swell, the lights below it only hairlines
  const light = tone.light ?? 0.18
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
      const width = 0.17 + Math.pow(clamp((dark - light) / (1 - light)), 1.25) * (SWELL - 0.17)
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
