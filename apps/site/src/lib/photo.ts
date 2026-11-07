import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

export function creditParts(credit: string) {
  const [beforeName, afterName = ''] = credit.split('{name}')
  const [between, afterUnsplash = ''] = afterName.split('{unsplash}')
  if (!credit.includes('{name}') || !afterName.includes('{unsplash}')) throw new Error('photo credit needs {name} and {unsplash}')
  return { beforeName, between, afterUnsplash }
}
