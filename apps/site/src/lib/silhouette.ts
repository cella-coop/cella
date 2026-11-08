// An icon as a cluster's silhouette (index.md, the assets): Phosphor's
// filled icon rasterised at build, its coverage a grid the brand turns
// into a signed distance, laid as a square in the middle of a figure's
// box, as tall as it.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { maskField, type Field } from '@cella/brand'

/** The grid an icon is read at, a side's cells: fine for its thinnest
 * stroke at a figure's size. */
const SIZE = 128

export async function iconField(name: string, w: number, h: number): Promise<Field> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`unknown Phosphor fill icon: ${name}`)
  }
  const path = createRequire(import.meta.url).resolve(`@phosphor-icons/core/assets/fill/${name}-fill.svg`)
  const { data } = await sharp(readFileSync(path), { density: 300 }).resize(SIZE, SIZE).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true })
  const side = h * 0.98
  return maskField({ w: SIZE, h: SIZE, data: Float32Array.from(data, (v) => v / 255) }, { x: (w - side) / 2, y: (h - side) / 2, w: side, h: side })
}
