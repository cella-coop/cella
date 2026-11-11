// A page's card (index.md, the card): the picture a link to it shows where
// it is shared, 1200 by 630, as Open Graph asks. On the dark ground, the
// lockup, and under it the page's hero as the page opens: its eyebrow,
// its heading, its thin parts thin, and its summary; beside them its photo
// engraved and cut into the brand's cells, bleeding off the right edge, in
// the hero's ink, or, with no photo, the mark. Its words are set as the
// brand's faces' outlines (fontkit), so it is drawn the same anywhere,
// whatever fonts the machine has; it is rendered once, at build.
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cluster, hex } from '@cella/brand'
import { getCollection } from 'astro:content'
import type * as Fontkit from 'fontkit'
import sharp from 'sharp'
import type Woff2 from 'wawoff2'
import type { Status } from '../schemas'
import { COVER, engrave } from './engrave'
import { focusIn } from './focus'
import { inkAt, postInk, seedOf } from './place'
import { dated, held, parts, posts, siteData } from './text'

import { CARD } from './meta'

/** What a card shows: its words, its photo and its ink, its cells' seed. */
export type Card = { key: string; eyebrow?: string; heading: string; summary?: string; photo?: string; ink: Status; seed: number }

// the brand's files, and its faces, which are the brand's to depend on;
// fontkit and wawoff2 by Node's own require, as the brand's tool loads
// them, since Vite's transform of them breaks the decompression
const require = createRequire(import.meta.url)
const brand = createRequire(require.resolve('@cella/brand/tokens.json'))
const fontkit = require('fontkit') as typeof Fontkit
const woff2 = require('wawoff2') as typeof Woff2
const tokens = JSON.parse(readFileSync(require.resolve('@cella/brand/tokens.json'), 'utf8')) as {
  hues: Record<Status, number>
  dark: { roles: Record<string, { hex: string }> }
}
const dark = (role: string) => tokens.dark.roles[role].hex

// the print's colours, as print.css mixes them: its ink deepened, and its
// paper washed with a sixth of it
const deep = (ink: Status) => hex([0.518, 0.085, tokens.hues[ink]])
const paper = (ink: Status) => hex([0.8966, 0.017, tokens.hues[ink]])

// A variable face of the brand's: its latin WOFF2 decompressed once, since
// fontkit varies only a TrueType's glyphs, one file at a time, since
// wawoff2's one WebAssembly instance garbles two decompressions at once
const fonts = new Map<string, Promise<Fontkit.Font>>()
let queue: Promise<unknown> = Promise.resolve()
function font(pkg: string) {
  if (!fonts.has(pkg)) {
    const files = join(dirname(brand.resolve(`${pkg}/package.json`)), 'files')
    const latin = readdirSync(files).find((f) => /-latin-wght-normal\.woff2$/.test(f))
    if (!latin) {
      throw new Error(`${pkg} has no latin wght woff2`)
    }
    const next = queue.then(async () => fontkit.create(Buffer.from(await woff2.decompress(readFileSync(join(files, latin))))))
    queue = next.catch(() => undefined)
    fonts.set(pkg, next)
  }
  return fonts.get(pkg)!
}

// that face at a weight
const faces = new Map<string, Promise<Fontkit.Font>>()
function face(pkg: string, wght: number) {
  const key = `${pkg}@${wght}`
  if (!faces.has(key)) {
    faces.set(
      key,
      font(pkg).then((f) => f.getVariation({ wght })),
    )
  }
  return faces.get(key)!
}

const DISPLAY = '@fontsource-variable/urbanist'
const TEXT = '@fontsource-variable/inter'

type Word = { text: string; font: Fontkit.Font }

const width = (w: Word, size: number) => (w.font.layout(w.text).advanceWidth * size) / w.font.unitsPerEm

/** Words in lines no wider than `max`, breaking where the text does. */
function wrap(lines: Word[][], size: number, max: number) {
  const out: Word[][] = []
  for (const line of lines) {
    let row: Word[] = []
    let at = 0
    for (const w of line) {
      const space = row.length ? width({ text: ' ', font: w.font }, size) : 0
      const wide = width(w, size)
      if (row.length && at + space + wide > max) {
        out.push(row)
        row = []
        at = 0
      }
      at += (row.length ? space : 0) + wide
      row.push(w)
    }
    out.push(row)
  }
  return out
}

/** A line set as outlines from its left at a baseline, tracked by `track`. */
function set(line: Word[], x: number, y: number, size: number, fill: string, track = 0) {
  let d = ''
  let at = x
  line.forEach((w, i) => {
    const text = i < line.length - 1 ? `${w.text} ` : w.text
    const run = w.font.layout(text)
    const k = size / w.font.unitsPerEm
    run.glyphs.forEach((g, j) => {
      d += g.path.scale(k, -k).translate(at, y).toSVG()
      at += run.positions[j].xAdvance * k + track
    })
  })
  return `<path fill="${fill}" d="${d}"/>`
}

const words = (text: string, font: Fontkit.Font) => text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, font }))

// the lockup, its inks as hex, which a rasteriser reads
const lockup = readFileSync(require.resolve('@cella/brand/lockup.svg'), 'utf8')
  .replace(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g, (_, l: string, c: string, h: string) => hex([Number(l), Number(c), Number(h)]))
  .replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')
const mark = readFileSync(require.resolve('@cella/brand/mark.svg'), 'utf8').replace(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/g, (_, l: string, c: string, h: string) =>
  hex([Number(l), Number(c), Number(h)]),
)

// where the words and the photo stand
const PAD = 72
const COLUMN = 540
const PHOTO = { x: 640, w: 560 }

/** A card as a PNG. */
export async function render(card: Card) {
  const { w, h } = CARD
  const [bold, thin, label, plain] = await Promise.all([face(DISPLAY, 820), face(DISPLAY, 300), face(TEXT, 600), face(TEXT, 400)])

  // the heading as large as fits three lines, its thin parts thin
  const written = card.heading
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((l) => parts(l).flatMap((p) => words(p.text, p.thin ? thin : bold)))
  let size = 74
  let heading = wrap(written, size, COLUMN)
  while (heading.length > 3 && size > 44) {
    size -= 4
    heading = wrap(written, size, COLUMN)
  }
  const summary = card.summary ? wrap([words(card.summary, plain)], 27, COLUMN).slice(0, 3) : []
  const eyebrow = card.eyebrow ? [{ text: card.eyebrow.toUpperCase(), font: label }] : []

  // the block of words, centred under the lockup
  const lead = size * 1.06
  const tall = (eyebrow.length ? 46 : 0) + heading.length * lead + (summary.length ? 22 + summary.length * 38 : 0)
  let y = 140 + (h - 140 - 60 - tall) / 2
  const shapes: string[] = []
  if (eyebrow.length) {
    y += 20
    shapes.push(set(eyebrow, PAD, y, 19, dark('text-subtle'), 3))
    y += 26
  }
  for (const line of heading) {
    y += lead
    shapes.push(set(line, PAD, y - size * 0.22, size, dark('text')))
  }
  y += summary.length ? 22 : 0
  for (const line of summary) {
    y += 38
    shapes.push(set(line, PAD, y - 9, 27, dark('text-muted')))
  }

  const picture = card.photo ? await cut(card) : `<svg x="${PHOTO.x + 80}" y="115" width="400" height="400">${mark.replace(/^<svg[^>]*>|<\/svg>\s*$/g, '')}</svg>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<rect width="${w}" height="${h}" fill="${dark('panel')}"/>
${picture}
<g transform="translate(${PAD} 56) scale(${40 / 110})" color="${dark('text')}">${lockup}</g>
${shapes.join('\n')}
</svg>`
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}

/** A card's photo engraved and cut into cells round its focus. */
async function cut(card: Card) {
  const photo = card.photo!
  const { h } = CARD
  const cells = cluster(PHOTO.w, h, { pitch: 92, gutter: 10, round: 14, seed: card.seed, drop: 0.2, bleed: 'r', focus: await focusIn(photo, PHOTO.w, h) })
  const print = (await engrave(photo, COVER, 'cover')).toString('base64')
  const image = `<image x="0" y="0" width="${PHOTO.w}" height="${h}" preserveAspectRatio="xMidYMid slice" href="data:image/png;base64,${print}" xlink:href="data:image/png;base64,${print}"/>`
  return `<g transform="translate(${PHOTO.x} 0)">
<defs><clipPath id="c">${cells.map((d) => `<path d="${d}"/>`).join('')}</clipPath><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${PHOTO.w}" height="${h}">${image}</mask></defs>
<g clip-path="url(#c)"><rect width="${PHOTO.w}" height="${h}" fill="${paper(card.ink)}"/><rect width="${PHOTO.w}" height="${h}" fill="${deep(card.ink)}" mask="url(#m)"/></g>
</g>`
}

// a hero's attribute, as its page's source writes it
const attr = (hero: string, name: string) => hero.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]

/** Every page's card a build makes: each page it keeps, by its hero. */
export async function pageCards(): Promise<Card[]> {
  const site = await siteData()
  const out = await held()
  const own = await getCollection('pages')
  const drafts = (await getCollection('pageDrafts')).filter((d) => !own.some((e) => e.id === d.id))
  return Promise.all(
    [...own, ...drafts]
      .filter((e) => !out.includes(e.id))
      .map(async (e) => {
        const hero = e.body?.match(/<Hero\b([^>]*)>/)?.[1] ?? ''
        return {
          key: e.id,
          eyebrow: attr(hero, 'eyebrow'),
          heading: attr(hero, 'heading') ?? e.data.title,
          summary: e.data.description ?? site.description,
          photo: attr(hero, 'photo'),
          ink: (attr(hero, 'ink') as Status | undefined) ?? (await inkAt(e.id, 0)),
          seed: seedOf(`${e.id}/hero`),
        }
      }),
  )
}

/** Every post's card a build makes: its date, title, summary and cover. */
export async function postCards(): Promise<Card[]> {
  if ((await held()).includes('blog')) {
    return []
  }
  return Promise.all(
    (await posts()).map(async (p) => ({
      key: p.id,
      eyebrow: dated(p.data.date),
      heading: p.data.title,
      summary: p.data.description,
      photo: p.data.photo,
      ink: await postInk(p.id),
      seed: seedOf(`blog/${p.id}`),
    })),
  )
}
