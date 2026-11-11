import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { printFile, dataUrl } from '@cella/brand/print-file'
import { printMarkup, PRINT_STYLES, type PrintStyleName } from '@cella/brand'
import { photoNames } from './assets.ts'

export const STATUSES = ['error', 'warning', 'success', 'info', 'help'] as const
export type Status = (typeof STATUSES)[number]

/** An unprinted photo's width, the print's: the file the build emits for
 * it, served by `pages/photo/[key].jpg.ts`, so no page inlines a photo. */
export const PLAIN = 800
export const plainKeys = () => photoNames().map((name) => ({ name, width: PLAIN }))

const jpg = (name: string) => readFileSync(join(process.cwd(), 'src/photos', `${name}.jpg`))

/** A photo as its plain file, at most the print's width. */
export const plainPhoto = (name: string) =>
  sharp(jpg(name)).resize({ width: PLAIN, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()

export async function loadPhoto(name: string, style: PrintStyleName | 'none') {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`invalid photo name: ${name}`)
  const dir = join(process.cwd(), 'src/photos')
  const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as { photographer: string; photographerUrl: string; photoUrl: string }
  if (style !== 'none' && !Object.hasOwn(PRINT_STYLES, style)) throw new Error(`unknown print style: ${style}`)
  const printed = style === 'none' ? undefined : await printFile(jpg(name), { width: PLAIN, style: PRINT_STYLES[style] })
  const plain = printed ? undefined : await plainSize(name)
  return {
    meta, printed, plain,
    masks: printed && printMarkup(printed, printed.masks.map(m => dataUrl(m.png))),
    ratio: printed && `aspect-ratio: ${printed.width} / ${printed.height}`,
  }
}

async function plainSize(name: string) {
  const { width = PLAIN, height = PLAIN } = await sharp(jpg(name)).metadata()
  const w = Math.min(width, PLAIN)
  return { src: `/photo/${name}-${PLAIN}.jpg`, width: w, height: Math.round((height * w) / width) }
}

export function creditParts(credit: string) {
  const [beforeName, afterName = ''] = credit.split('{name}')
  const [between, afterUnsplash = ''] = afterName.split('{unsplash}')
  if (!credit.includes('{name}') || !afterName.includes('{unsplash}')) throw new Error('photo credit needs {name} and {unsplash}')
  return { beforeName, between, afterUnsplash }
}
