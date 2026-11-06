// A picture printed at build time, for a site: read with sharp at the
// width it is shown, printed by the core, each mask a PNG whose alpha is
// the ink's coverage. The page lays them with printMarkup(), so no script
// ships and the colours stay CSS.

import sharp from 'sharp'
import { print, type Print, type PrintOptions } from './print.ts'

export type PrintedFile = Omit<Print, 'masks'> & { masks: { ink: string; png: Buffer }[] }

/** A picture, a path or its bytes, printed at `width` pixels. */
export async function printFile(src: string | Buffer | Uint8Array, { width, ...options }: PrintOptions & { width: number }): Promise<PrintedFile> {
  const { data, info } = await sharp(src).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const p = print({ width: info.width, height: info.height, data }, options)
  const masks = await Promise.all(p.masks.map(async ({ ink, alpha }) => {
    // grey and alpha: the grey black, the alpha the coverage
    const raw = Buffer.alloc(alpha.length * 2)
    alpha.forEach((a, i) => {
      raw[i * 2 + 1] = a
    })
    const png = await sharp(raw, { raw: { width: p.width, height: p.height, channels: 2 } }).toColourspace('b-w').png({ compressionLevel: 9 }).toBuffer()
    return { ink, png }
  }))
  return { ...p, masks }
}

/** A mask as a data: URL, for a page that inlines its print. */
export const dataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString('base64')}`
