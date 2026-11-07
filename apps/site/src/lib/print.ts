// A photo in the house's print, as the brand explorer shows one: a picture
// on the print's light paper in a real ink, the same in either theme
// (index.md, prints). Its mask is printed once, at build, at the width it
// is shown, the cell 2.5 CSS pixels at 1.5 device pixels to one, and
// served as its own file by `pages/print/[key].png.ts`. A mask is the
// same in any ink, so the page colours it, and a change of ink is CSS.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { PRINT_STYLES } from '@cella/brand'
import { printFile } from '@cella/brand/print-file'
import { photoNames } from './assets'
import { STATUSES, type Status } from './photo'

/** The widths a print is made at, in CSS pixels: a panel's, a tile's or a
 * phone's, and the asset library's enlarged view, made in the dev server
 * alone. */
export const WIDTHS = { large: 600, small: 360, full: 1200 } as const
export type Size = keyof typeof WIDTHS
const BUILT: Size[] = import.meta.env.DEV ? ['large', 'small', 'full'] : ['large', 'small']

const SCALE = 1.5

const file = (name: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`invalid photo name: ${name}`)
  return join(process.cwd(), 'src/photos', `${name}.jpg`)
}

export const maskUrl = (name: string, size: Size) => `/print/${name}-${WIDTHS[size]}.png`

/** Every mask a build makes: each photo at each width. */
export const maskKeys = () => photoNames().flatMap((name) => BUILT.map((size) => ({ name, width: WIDTHS[size] })))

/** One photo's mask at a width, as a PNG: its alpha the ink's coverage.
 * The photo is levelled first, its darkest and lightest hundredth taken to
 * black and white, so a high-key photo is not bare paper nor a dark one a
 * slab: each spans the print's range. */
export async function mask(name: string, width: number) {
  const levelled = await sharp(readFileSync(file(name))).normalise({ lower: 1, upper: 99 }).toBuffer()
  const printed = await printFile(levelled, { width: Math.round(width * SCALE), scale: SCALE, style: PRINT_STYLES.house })
  return printed.masks[0].png
}

/** A photo's ink, unless one is named: its own, from its name, the same on
 * every page. */
export const inkOf = (name: string, ink?: Status): Status =>
  ink ?? STATUSES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % STATUSES.length]

/** The CSS colour of a status's print ink. */
export const inkVar = (ink: Status) => `var(--print-${ink}-deep)`

/** A photo's width over its height. */
export async function ratio(name: string) {
  const { width = 3, height = 2 } = await sharp(file(name)).metadata()
  return width / height
}
