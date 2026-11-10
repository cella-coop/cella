// An avatar (index.md, figures): a photo cut into a few of the brand's
// cells round its focus, and one large cell beside them, its panel, that
// holds words, all one diagram (`avatar` in @cella/brand), so the panel
// meets the photo's cells across the same gutter as they meet each other.
// The brand lays the panel on the right; an avatar that wants it on the
// left mirrors the cells, and one that wants it below, on a narrow
// screen, turns them, never the photo, which keeps its own way up.
import { avatar, avatarFrame } from '@cella/brand'
import { focusIn } from './focus'

/** Where an avatar's panel stands beside its photo on a wide screen. */
export type Side = 'left' | 'right'

/** A layout of an avatar: its box, its cells and its panel, as SVG paths
 * in the box, where its photo lies, and where its words stand, as
 * percentages of the box from each edge. */
export type Shape = {
  w: number
  h: number
  cells: string[]
  panel: string
  photo: { x: number; y: number; w: number; h: number }
  words: { top: number; right: number; bottom: number; left: number }
}

const LOOK = { pitch: 130, gutter: 13, round: 18 }
// beside: the photo near square, the panel most of the rest; below: the
// photo a little taller than wide, the panel under it
const BESIDE = { w: 1700, h: 900, seam: 0.5 }
const BELOW = { w: 1600, h: 900, seam: 0.58 }

// every point of a path moved: its numbers are its points, x then y
const moved = (d: string, to: (x: number, y: number) => [number, number]) =>
  d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) =>
    to(Number(x), Number(y))
      .map((v) => v.toFixed(1))
      .join(' '),
  )

const pct = (v: number, of: number) => (v / of) * 100

/** Where a layout's words stand, as a CSS inset. */
export const inset = ({ top, right, bottom, left }: Shape['words']) => [top, right, bottom, left].map((v) => `${v.toFixed(2)}%`).join(' ')

/** An avatar's two layouts: `beside`, its panel on `side`, and `below`,
 * for a narrow column, its panel under its photo. */
export async function avatarOf(photo: string, seed: number, side: Side = 'right'): Promise<{ beside: Shape; below: Shape }> {
  return { beside: await beside(photo, seed, side), below: await below(photo, seed) }
}

async function beside(photo: string, seed: number, side: Side): Promise<Shape> {
  const { w, h, seam } = BESIDE
  const frame = avatarFrame(w, h, { ...LOOK, seam })
  const p = frame.photo
  const left = side === 'left'
  // the focus where the brand lays it, the photo's own mirrored with it
  const focus = (await focusIn(photo, p, h)).map((f) => (left ? { ...f, x: p - f.x } : f))
  const { cells, panel } = avatar(w, h, { ...LOOK, seam, seed, focus })
  const flip = (x: number, y: number): [number, number] => [w - x, y]
  const edge = pct(frame.words, w)
  return {
    w,
    h,
    cells: left ? cells.map((d) => moved(d, flip)) : cells,
    panel: left ? moved(panel, flip) : panel,
    photo: { x: left ? w - p : 0, y: 0, w: p, h },
    words: { top: 0, bottom: 0, left: left ? 0 : edge, right: left ? edge : 0 },
  }
}

async function below(photo: string, seed: number): Promise<Shape> {
  const { w, h, seam } = BELOW
  const frame = avatarFrame(w, h, { ...LOOK, seam })
  const p = frame.photo
  // the brand's box turned: its width the avatar's height
  const focus = (await focusIn(photo, h, p)).map((f) => ({ ...f, x: f.y, y: f.x }))
  const { cells, panel } = avatar(w, h, { ...LOOK, seam, seed, focus })
  const turn = (x: number, y: number): [number, number] => [y, x]
  return {
    w: h,
    h: w,
    cells: cells.map((d) => moved(d, turn)),
    panel: moved(panel, turn),
    photo: { x: 0, y: 0, w: h, h: p },
    words: { top: pct(frame.words, w), bottom: 0, left: 0, right: 0 },
  }
}
