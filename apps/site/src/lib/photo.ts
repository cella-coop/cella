import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { printFile, dataUrl } from '@cella/brand/print-file'
import { printMarkup, PRINT_STYLES, type PrintStyleName } from '@cella/brand'

export const STATUSES = ['error', 'warning', 'success', 'info', 'help'] as const
export type Status = (typeof STATUSES)[number]

export async function loadPhoto(name: string, style: PrintStyleName | 'none') {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`invalid photo name: ${name}`)
  const dir = join(process.cwd(), 'src/photos')
  const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as { photographer: string; photographerUrl: string; photoUrl: string }
  const image = readFileSync(join(dir, `${name}.jpg`))
  if (style !== 'none' && !Object.hasOwn(PRINT_STYLES, style)) throw new Error(`unknown print style: ${style}`)
  const printed = style === 'none' ? undefined : await printFile(image, { width: 800, style: PRINT_STYLES[style] })
  return {
    meta, printed,
    masks: printed && printMarkup(printed, printed.masks.map(m => dataUrl(m.png))),
    ratio: printed && `aspect-ratio: ${printed.width} / ${printed.height}`,
    original: `data:image/jpeg;base64,${image.toString('base64')}`,
  }
}

/** A photo printed as a backdrop, in one tone: its ink's status. The page
 * lays the masks on a paper of that tone in the theme's shades, so the
 * light theme's are the print of the photo, dark ink where it is dark,
 * and the dark theme's the print of its negative, light ink where it is
 * light: a positive in either theme. */
export async function loadBackdrop(name: string, width: number, ink?: Status) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`invalid photo name: ${name}`)
  const dir = join(process.cwd(), 'src/photos')
  const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as { photographer: string; photographerUrl: string; photoUrl: string }
  // Unset, a photo's ink is its own, the same on every page it is shown
  ink ??= STATUSES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % STATUSES.length]
  const image = readFileSync(join(dir, `${name}.jpg`))
  const negative = await sharp(image).negate({ alpha: false }).toBuffer()
  const masks = async (src: Buffer) =>
    (await printFile(src, { width, style: PRINT_STYLES.house, ink })).masks.map((m) => dataUrl(m.png))
  return { meta, tone: ink, light: await masks(image), dark: await masks(negative) }
}

export function creditParts(credit: string) {
  const [beforeName, afterName = ''] = credit.split('{name}')
  const [between, afterUnsplash = ''] = afterName.split('{unsplash}')
  if (!credit.includes('{name}') || !afterName.includes('{unsplash}')) throw new Error('photo credit needs {name} and {unsplash}')
  return { beforeName, between, afterUnsplash }
}
