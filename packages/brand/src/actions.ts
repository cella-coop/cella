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
