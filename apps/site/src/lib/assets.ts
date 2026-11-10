// The asset library's parts (index.md, the assets): each a page of
// `/assets` in the dev server alone, named by an identifier, never copy.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

export const PARTS = [
  { name: 'photos', icon: 'images' },
  { name: 'cutouts', icon: 'scissors' },
  { name: 'interest', icon: 'crosshair' },
  { name: 'diagrams', icon: 'flow-arrow' },
  { name: 'icons', icon: 'shapes' },
  { name: 'components', icon: 'squares-four' },
] as const

export type Part = (typeof PARTS)[number]['name']

export const nav = PARTS.map((p) => ({ label: p.name, href: `/assets/${p.name}` }))

/** A photo as it is, no engraving, `width` wide, as a data URL: the
 * library shows it beside what is found in it. */
export async function preview(name: string, width: number): Promise<{ src: string; w: number; h: number }> {
  const { data, info } = await sharp(readFileSync(join(process.cwd(), 'src/photos', `${name}.jpg`)))
    .resize({ width })
    .jpeg({ quality: 70 })
    .toBuffer({ resolveWithObject: true })
  return { src: `data:image/jpeg;base64,${data.toString('base64')}`, w: info.width, h: info.height }
}

/** Every vendored photo's name, in order. */
export function photoNames(): string[] {
  try {
    return readdirSync(join(process.cwd(), 'src/photos'))
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.slice(0, -4))
      .sort()
  } catch {
    return []
  }
}
