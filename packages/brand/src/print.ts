// The print: a picture as one to three ink separations, ported from the
// explorer's printInto(). Each ink covers the tones darker than its edge,
// through a screen (flat, an angled dot, or grain), shifted by its own
// misregistration and eaten by the paper's tooth. The core gives each
// ink's coverage as an alpha mask and paints nothing: CSS lays the masks
// on the paper in their inks, so it touches no DOM and runs in node and
// the browser alike.

import { clamp, type Oklch } from './color.ts'
import { inkAction, PENTAD, type House, type Status, type ToneName } from './house.ts'
import { shades, sunkL } from './tones.ts'

export type PrintLayer = { ink: string; edge: number }

export type PrintStyle = {
  layers: PrintLayer[]
  soft: number
  smooth: number
  screen: 'flat' | 'halftone' | 'grain'
  cell: number
  angle: number
  mis: number
  tooth: number
  toothScale: number
  over: 'multiply' | 'opaque'
  /** The first ink turns through the five, one status to a picture. */
  rotate?: boolean
}

/** What a picture's luma is given before it is separated. */
export type PrintTone = { contrast: number; bright: number; gamma: number }

const preset = (label: string, layers: [string, number][], rest: Omit<PrintStyle, 'layers'>) => ({
  label,
  layers: layers.map(([ink, edge]) => ({ ink, edge })),
  ...rest,
})

/** The explorer's print styles; `house` is house.json's. */
export const PRINT_STYLES = {
  house: preset('Five-ink halftone · the default', [['info-deep', 0.5]], { soft: 1, smooth: 0, screen: 'halftone', cell: 2.5, angle: 23, mis: 0, tooth: 0, toothScale: 3, over: 'multiply', rotate: true }),
  screen: preset('Screen print · two colours', [['accent-fill', 0.62], ['text', 0.3]], { soft: 0.03, smooth: 1.5, screen: 'flat', cell: 6, angle: 15, mis: 2.5, tooth: 0.35, toothScale: 4, over: 'opaque' }),
  riso: preset('Riso · two drums', [['accent-fill', 0.72], ['text', 0.38]], { soft: 0.3, smooth: 0, screen: 'grain', cell: 1.5, angle: 0, mis: 3, tooth: 0.3, toothScale: 6, over: 'multiply' }),
  duotone: preset('90s duotone', [['accent-fill', 0.9], ['text', 0.45]], { soft: 0.5, smooth: 0, screen: 'halftone', cell: 3.5, angle: 15, mis: 0, tooth: 0, toothScale: 4, over: 'multiply' }),
  poster: preset('Halftone poster · three inks', [['warning-fill', 0.8], ['accent-fill', 0.58], ['text', 0.32]], { soft: 0.3, smooth: 1, screen: 'halftone', cell: 8, angle: 15, mis: 2, tooth: 0.15, toothScale: 5, over: 'multiply' }),
  tricolour: preset('Cut stencil · three tints', [['accent-light', 0.78], ['accent-fill', 0.52], ['text', 0.27]], { soft: 0.03, smooth: 4, screen: 'flat', cell: 6, angle: 15, mis: 1.5, tooth: 0.25, toothScale: 4, over: 'opaque' }),
  dense: preset('One-colour halftone · dense', [['text', 0.5]], { soft: 1, smooth: 0, screen: 'halftone', cell: 2.5, angle: 45, mis: 0, tooth: 0, toothScale: 3, over: 'multiply' }),
  mono: preset('One-colour halftone', [['text', 0.5]], { soft: 1, smooth: 0, screen: 'halftone', cell: 5, angle: 45, mis: 0, tooth: 0.1, toothScale: 3, over: 'multiply' }),
  xerox: preset('Photocopy', [['text', 0.46]], { soft: 0.05, smooth: 0.5, screen: 'flat', cell: 2, angle: 0, mis: 0, tooth: 0.6, toothScale: 2, over: 'multiply' }),
} satisfies Record<string, PrintStyle & { label: string }>

export type PrintStyleName = keyof typeof PRINT_STYLES

/** The explorer's tone for a picture, house.json's dither. */
export const PRINT_TONE: PrintTone = { contrast: 0.15, bright: 0, gamma: 1 }

/** The inks a print may take, as the explorer names its roles: a shade of
    a tone, the action's fill, the well, or white. */
const INKS: Record<string, [number | 'fill' | 'sunk' | 'white', ToneName]> = {
  paper: [0, 'base'],
  ...Object.fromEntries(PENTAD.map((s) => [`${s}-deep`, [6, s]])),
  text: [9, 'base'],
  muted: [7, 'base'],
  'accent-fill': ['fill', 'accent'],
  'accent-light': [4, 'accent'],
  'accent-text': [8, 'accent'],
  ...Object.fromEntries(PENTAD.map((s) => [`${s}-fill`, ['fill', s]])),
  'warning-light': [4, 'warning'],
  sunk: ['sunk', 'base'],
  white: ['white', 'base'],
}

export const PRINT_INKS = Object.keys(INKS)

/** An ink's colour, or the paper's: the light theme's in either, since a
    print is a physical thing. */
export function printInk(house: House, name: string): Oklch {
  const ink = INKS[name]
  if (!ink) {
    throw new Error(`no print ink ${name}; one of ${PRINT_INKS.join(', ')}`)
  }
  const [s, tone] = ink
  const { c, h } = house.tones[tone]
  const l = s === 'sunk' ? sunkL(house, 1) : s === 'fill' ? (tone === 'accent' && inkAction(house) ? shades(house, 1)[9] : house.accentL) : s === 'white' ? 0.98 : shades(house, 1)[s]
  return [l, s === 'white' ? Math.min(c, 0.01) : c, h]
}

/** A picture's pixels, RGBA, row by row. */
export type Pixels = { width: number; height: number; data: ArrayLike<number> }

/** An ink's coverage at each pixel, 0 to 255. */
export type Mask = { ink: string; alpha: Uint8ClampedArray }

export type Print = { width: number; height: number; over: PrintStyle['over']; masks: Mask[] }

export type PrintOptions = {
  style?: PrintStyle
  tone?: PrintTone
  /** The first ink's turn where the style rotates. */
  ink?: Status
  /** Device pixels to a CSS pixel: the screen, the smoothing, the
      misregistration and the tooth are drawn at it. */
  scale?: number
}

const TAU = Math.PI * 2

function luma({ width: w, height: h, data }: Pixels, r: number): Float32Array {
  let a = new Float32Array(w * h)
  for (let i = 0; i < a.length; i++) {
    a[i] = 0.2126 * (data[i * 4] / 255) + 0.7152 * (data[i * 4 + 1] / 255) + 0.0722 * (data[i * 4 + 2] / 255)
  }
  if (r < 0.5) {
    return a
  }
  // two box passes, each across and then down
  const b = new Float32Array(a.length)
  const rad = Math.max(1, Math.round(r))
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0
      for (let x = -rad; x <= rad; x++) {
        acc += a[y * w + clamp(x, 0, w - 1)]
      }
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * rad + 1)
        acc += a[y * w + Math.min(w - 1, x + rad + 1)] - a[y * w + Math.max(0, x - rad)]
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let y = -rad; y <= rad; y++) {
        acc += b[clamp(y, 0, h - 1) * w + x]
      }
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * rad + 1)
        acc += b[Math.min(h - 1, y + rad + 1) * w + x] - b[Math.max(0, y - rad) * w + x]
      }
    }
  }
  return a
}

const adjust = (x: number, t: PrintTone): number => clamp((x - 0.5) * (1 + t.contrast) + 0.5 + t.bright) ** (1 / t.gamma)

function hash2(x: number, y: number, s: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

/** Two octaves of value noise: where an ink takes and where it skips. */
function tooth(w: number, h: number, scale: number, seed: number): Float32Array {
  const out = new Float32Array(w * h)
  const smooth = (t: number) => t * t * (3 - 2 * t)
  for (const [sc, wt] of [[scale, 0.65], [scale / 2.7, 0.35]]) {
    const s = Math.max(0.6, sc)
    for (let y = 0; y < h; y++) {
      const gy = y / s
      const y0 = Math.floor(gy)
      const fy = smooth(gy - y0)
      for (let x = 0; x < w; x++) {
        const gx = x / s
        const x0 = Math.floor(gx)
        const fx = smooth(gx - x0)
        const a = hash2(x0, y0, seed)
        const b = hash2(x0 + 1, y0, seed)
        const c = hash2(x0, y0 + 1, seed)
        const d = hash2(x0 + 1, y0 + 1, seed)
        out[y * w + x] += wt * ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy)
      }
    }
  }
  return out
}

/** The picture printed: each inked layer's mask, in the order laid. */
export function print(pixels: Pixels, { style = PRINT_STYLES.house, tone = PRINT_TONE, ink = 'error', scale = 1 }: PrintOptions = {}): Print {
  const { width: w, height: h } = pixels
  const L = luma(pixels, style.smooth * scale)
  const cell = Math.max(1, style.cell * scale)
  const soft = Math.max(0.005, style.soft)
  const aa = 1.2 / cell
  const masks = style.layers.filter((l) => l.ink !== 'off').map((l, i): Mask => {
    const a = ((style.angle + [0, 60, 30][i % 3]) * Math.PI) / 180
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const dir = i * 2.4 + 0.7
    const dx = i === 0 ? 0 : Math.round(Math.cos(dir) * style.mis * scale)
    const dy = i === 0 ? 0 : Math.round(Math.sin(dir) * style.mis * scale)
    const grit = style.tooth > 0 ? tooth(w, h, style.toothScale * scale, 11 + i * 17) : null
    const alpha = new Uint8ClampedArray(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = adjust(L[clamp(y - dy, 0, h - 1) * w + clamp(x - dx, 0, w - 1)], tone)
        let cov = clamp((l.edge - v) / soft + 0.5)
        if (cov <= 0) {
          continue
        }
        if (style.screen === 'halftone') {
          const u = (x * ca + y * sa) / cell
          const t = (-x * sa + y * ca) / cell
          const spot = 0.5 + 0.25 * (Math.cos(TAU * u) + Math.cos(TAU * t))
          cov = clamp((spot - (1 - cov)) / aa + 0.5)
        } else if (style.screen === 'grain') {
          cov = cov > hash2(Math.floor(x / cell), Math.floor(y / cell), 3 + i * 7) ? 1 : 0
        }
        if (grit) {
          cov *= clamp(1 - style.tooth * (grit[y * w + x] * 2.2 - 0.6))
        }
        alpha[y * w + x] = cov * 255
      }
    }
    return { ink: i === 0 && style.rotate ? `${ink}-deep` : l.ink, alpha }
  })
  return { width: w, height: h, over: style.over, masks }
}

const attr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The layers of a print over its masks' URLs, for a `.cella-print` or a
    `<cella-print>`, which print.css makes the paper. */
export const printMarkup = (p: { masks: { ink: string }[] }, urls: string[]): string =>
  p.masks.map((m, i) => `<span style="--mask: url(&quot;${attr(urls[i])}&quot;); --ink: var(--print-${m.ink})"></span>`).join('')

/** The attributes of a print's container: its shape and how it lays its
    inks. */
export const printAttrs = (p: Pick<Print, 'width' | 'height' | 'over'>): string => `data-over="${p.over}" style="aspect-ratio: ${p.width} / ${p.height}"`
