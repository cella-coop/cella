// A row of actions as a row of cells: side by side, their tops and feet
// flat, each pair sharing a slanted edge parted by one gutter, the row's
// two ends bulging to a point past the label. A lone action is a row of
// one, pointed at both ends. The site draws its rows of links from it and
// the shell its buttons, each by its own box.

import { roundedPath, type Point } from './mark.ts'

/** A cell's end: a point bulging past its label, at a height of the
 * cell's (0 its top, 1 its foot); or an edge it shares with the cell
 * beside it, its top leaning forward by `tilt` (backward when negative),
 * its middle `at` past the cell's box, parted from the other cell's edge
 * by `gutter`, measured across the slant. */
export type ActionEnd = { point: number } | { tilt: number; gutter: number; at?: number }

/** How far a pointed end bulges, in the cell's heights. */
export const ACTION_BULGE = 0.3

/** How round a cell's corners are, in its heights. */
export const ACTION_ROUND = 0.2

/** A cell's corners, its box from `l` to `r` and 0 to `h`. */
export function actionCell(l: number, r: number, h: number, left: ActionEnd, right: ActionEnd): Point[] {
  const bulge = h * ACTION_BULGE
  // half the gutter, as a horizontal shift that parts a slanted edge by it
  const half = (e: { tilt: number; gutter: number }) => ((e.gutter / 2) * Math.hypot(h, e.tilt)) / h
  const lead: Point[] = 'point' in left
    ? [[l + bulge, 0], [l, h * left.point], [l + bulge, h]]
    : [[l - (left.at ?? 0) + left.tilt / 2 + half(left), 0], [l - (left.at ?? 0) - left.tilt / 2 + half(left), h]]
  const tail: Point[] = 'point' in right
    ? [[r - bulge, h], [r, h * right.point], [r - bulge, 0]]
    : [[r + (right.at ?? 0) - right.tilt / 2 - half(right), h], [r + (right.at ?? 0) + right.tilt / 2 - half(right), 0]]
  return [...lead, ...tail]
}

/** A row's cells, laid edge to edge at these widths: each shared edge
 * tilted by a draw from `rand`, alternately forward and back, and each
 * end's point at a height drawn about the middle. */
export function actionCells(widths: number[], h: number, rand: () => number, gutter: number): Point[][] {
  const xs = widths.reduce((acc, w) => [...acc, acc[acc.length - 1] + w], [0])
  const tilt = xs.map((_, i) => (i % 2 ? 1 : -1) * h * (0.14 + rand() * 0.12))
  const last = widths.length - 1
  return widths.map((_, i) => {
    const left: ActionEnd = i === 0 ? { point: 0.42 + rand() * 0.16 } : { tilt: tilt[i], gutter }
    const right: ActionEnd = i === last ? { point: 0.42 + rand() * 0.16 } : { tilt: tilt[i + 1], gutter }
    return actionCell(xs[i], xs[i + 1], h, left, right)
  })
}

/** A cell's outline as a path, its corners softened. */
export function actionPath(cell: Point[], h: number, f: (v: number) => string): string {
  return roundedPath(cell, h * ACTION_ROUND, f)
}

/** How far apart two cells of a row stand, box to box, in their heights:
 * a shared edge sits in the middle of it. */
export const ACTION_GAP = 0.25

/** How far a cell's drawing reaches past its box, in its heights: across,
 * for a shared edge leaning into the gap and the focus ring round it, and
 * up and down, for the ring alone. */
export const ACTION_REACH = 0.375
export const ACTION_RING = 1 / 16

/** How far into its box a cell's end reaches before its top and foot run
 * flat, rounding and all, in its heights. */
export const ACTION_END = 0.5

/** The tilt of a shared edge and the gutter parting it, in the cell's
 * heights: the middle of the site's seeded range, and its width at the
 * shell's size. */
export const ACTION_TILT = 0.2
export const ACTION_GUTTER = 0.125

/** A cell's ends, each as the shell draws it: pointed, or an edge shared
 * with the cell beside it leaning forward (`fore`) or back. */
export const ACTION_ENDS = ['point', 'fore', 'back'] as const
export type ActionEndKind = (typeof ACTION_ENDS)[number]

// A cell's ends, the start and the end, as three masks each: its fill,
// its edge (the inner half of a stroke as wide as the ring, clipped to
// it, a pixel wide) and its focus ring (a stroke astride its outline,
// standing as wide as the ring reaches past it). A tile is drawn
// at a height of 32, the shell's, in pixels, its ring's reach above and
// below; a mask scales it to the cell's height.
function actionTile(side: 'start' | 'end', kind: ActionEndKind, layer: 'fill' | 'edge' | 'ring'): string {
  const h = 32
  const far = 100
  const end: ActionEnd = kind === 'point' ? { point: 0.5 } : { tilt: (kind === 'fore' ? 1 : -1) * h * ACTION_TILT, gutter: h * ACTION_GUTTER, at: (h * ACTION_GAP) / 2 }
  const pointed: ActionEnd = { point: 0.5 }
  const cell = side === 'start' ? actionCell(0, far, h, end, pointed) : actionCell(0, far, h, pointed, end)
  const d = actionPath(cell, h, (v) => String(+v.toFixed(2)))
  const reach = h * ACTION_REACH
  const ring = h * ACTION_RING
  const w = reach + h * ACTION_END
  const x = side === 'start' ? -reach : far - h * ACTION_END
  const body =
    layer === 'fill'
      ? `<path d="${d}"/>`
      : layer === 'edge'
        ? `<clipPath id="c"><path d="${d}"/></clipPath><path d="${d}" fill="none" stroke="#000" stroke-width="${ring}" clip-path="url(#c)"/>`
        : `<path d="${d}" fill="none" stroke="#000" stroke-width="${ring * 2}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${-ring} ${w} ${h + 2 * ring}">${body}</svg>`
}

const url = (svg: string): string => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}")`

/** Every end of a cell as a mask, `--cell-<side>-<kind>-<layer>`, and the
 * proportions they are drawn at, which a shell's buttons are laid out by
 * (`apps/org`'s `Button`): a block of tokens.css. */
export function actionsCss(): string {
  const lines = [
    `--cell-gap: ${ACTION_GAP};`,
    `--cell-reach: ${ACTION_REACH};`,
    `--cell-ring: ${ACTION_RING};`,
    `--cell-end: ${ACTION_END};`,
    ...(['start', 'end'] as const).flatMap((side) => ACTION_ENDS.flatMap((kind) => (['fill', 'edge', 'ring'] as const).map((layer) => `--cell-${side}-${kind}-${layer}: ${url(actionTile(side, kind, layer))};`))),
  ]
  return `:root {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`
}
