// The wordmark, CELLA in the display face at the mark's weight and
// tracking, set from glyph outlines so it needs no font to show, and its
// lockups with the mark, laid out as the explorer's .lockup lays them: the
// mark at `scale` times the name's height, `gap` of it apart, beside the
// name and centred on its line, or above it and centred on its width.

import { markBox } from './mark.ts'
import type { Mark } from './house.ts'

/** A glyph's outline in font units, y up, as a font reader gives it. */
export type Glyph = { advance: number; commands: { command: string; args: number[] }[] }

/** The face's metrics and the name's glyphs, at the mark's weight. */
export type Outlines = { unitsPerEm: number; ascent: number; descent: number; capHeight: number; glyphs: Glyph[] }

/** The name the mark spells, in its case. */
export const name = (m: Mark): string => (m.case === 'caps' ? 'CELLA' : 'Cella')

const OPS: Record<string, string> = { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }

const n = (v: number): string => String(+v.toFixed(2))

/** The name set at a font size h, its line box's top at y: one path, its
    width and its baseline. */
function setName(face: Outlines, m: Mark, h: number, x0: number, y: number): { d: string; width: number; baseline: number } {
  const s = h / face.unitsPerEm
  /* line-height 1: the content area, ascent to descent, is centred on
     the line box */
  const baseline = y + (h - (face.ascent - face.descent) * s) / 2 + face.ascent * s
  let x = x0
  let d = ''
  face.glyphs.forEach((g, i) => {
    for (const { command, args } of g.commands) {
      const pts = []
      for (let k = 0; k < args.length; k += 2) {
        pts.push(`${n(x + args[k] * s)} ${n(baseline - args[k + 1] * s)}`)
      }
      d += OPS[command] + pts.join(' ')
    }
    x += g.advance * s + (i < face.glyphs.length - 1 ? m.track * h : 0)
  })
  return { d, width: x - x0, baseline }
}

/** The mark's drawing placed in a box of its own. */
function place(mark: string, x: number, y: number, size: number): string {
  const [vx, vy, vs] = markBox(mark)
  const body = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" viewBox="${n(vx)} ${n(vy)} ${n(vs)} ${n(vs)}">${body}</svg>`
}

const svg = (w: number, h: number, inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(w)}" height="${n(h)}" role="img" aria-label="Cella">${inner}</svg>\n`

/** The name alone, cropped to its capitals, in currentColor. */
export function wordmarkSvg(face: Outlines, m: Mark, h = 100): string {
  const s = h / face.unitsPerEm
  const set = setName(face, m, h, 0, 0)
  const top = set.baseline - face.capHeight * s
  const inner = `<path transform="translate(0 ${n(-top)})" fill="currentColor" d="${set.d}"/>`
  return svg(set.width, face.capHeight * s, inner)
}

/** The mark and the name, beside or above it, the name in currentColor. */
export function lockupSvg(face: Outlines, m: Mark, mark: string, lockup: 'row' | 'stack', h = 100): string {
  const size = h * m.scale
  const gap = h * m.gap
  const width = setName(face, m, h, 0, 0).width
  if (lockup === 'row') {
    const tall = Math.max(size, h)
    const set = setName(face, m, h, size + gap, (tall - h) / 2)
    return svg(size + gap + width, tall, place(mark, 0, (tall - size) / 2, size) + `<path fill="currentColor" d="${set.d}"/>`)
  }
  const wide = Math.max(size, width)
  const set = setName(face, m, h, (wide - width) / 2, size + gap)
  return svg(wide, size + gap + h, place(mark, (wide - size) / 2, 0, size) + `<path fill="currentColor" d="${set.d}"/>`)
}
