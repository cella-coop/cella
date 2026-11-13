// The brand's five inks as the ink specimen proposes them for the shell
// (`/specimens/ink`): each a hue, worn by a role at a lightness for each
// theme. One table draws them and measures them, so the contrast the
// specimen states is the contrast it draws. A candidate, on the specimen
// alone, until the operator has reviewed it.
import { contrast, type Oklch } from '@cella/brand'

/** The pentad's hues, `--p0` to `--p4` in the brand's tokens: error,
 * warning, success, info, help. */
export const HUES = [30, 80, 159, 237, 295] as const

/** The order inks are handed out in, the site's turn started at the blue:
 * blue, gold, green, violet, coral, so neighbours never share a family
 * and the first area's primary action never reads as a refusal. */
export const TURN = [3, 1, 2, 4, 0] as const

type Theme = 1 | -1
type Role = { light: number; dark: number; c: number }

/** Where a role stands in each theme. The fill is the primary action's
 * cell, the same in both themes so white reads on it; the wash a
 * secondary action's, a selected row's or an avatar's ground, and its
 * text; the mark an icon or a ring drawn on the shell's surfaces. */
export const ROLES = {
  fill: { light: 0.52, dark: 0.52, c: 0.13 },
  wash: { light: 0.9, dark: 0.34, c: 0.045 },
  onWash: { light: 0.36, dark: 0.86, c: 0.1 },
  mark: { light: 0.52, dark: 0.72, c: 0.13 },
} as const satisfies Record<string, Role>

/** The text on a fill, the site's near white. */
export const ON_FILL: Oklch = [0.985, 0.004, 250]

// The brand's surfaces and text, a lightness mirrored around its
// midpoint by the theme's sign (`--shade-*` in its tokens).
const MID = 0.61
const BASE = [0.004, 250] as const
const SHADES = { panel: 0.3588, ground: 0.3041, text: -0.3312 } as const

const at = (r: Role, t: Theme): number => (t === 1 ? r.light : r.dark)
const shade = (k: number, t: Theme): Oklch => [MID + t * k, ...BASE]

/** A role's colour in a theme, at an ink. */
export const tone = (r: Role, ink: number, t: Theme): Oklch => [at(r, t), r.c, HUES[ink]]

// A role as CSS: its two lightnesses as one, mirrored by `--theme`, so
// a region wearing the other theme draws the other's.
function css(r: Role, ink: number): string {
  const mid = (r.light + r.dark) / 2
  const half = (r.light - r.dark) / 2
  return `oklch(calc(${mid} + var(--theme) * ${half}) ${r.c} ${HUES[ink]})`
}

/** The custom properties an inked element wears: `--fill`, `--on-fill`,
 * `--wash`, `--on-wash` and `--mark`. */
export function inked(ink: number): string {
  const [l, c, h] = ON_FILL
  return [
    `--fill: ${css(ROLES.fill, ink)}`,
    `--on-fill: oklch(${l} ${c} ${h})`,
    `--wash: ${css(ROLES.wash, ink)}`,
    `--on-wash: ${css(ROLES.onWash, ink)}`,
    `--mark: ${css(ROLES.mark, ink)}`,
  ].join('; ')
}

/** A name's ink, the same wherever it appears: its words seeded into
 * the turn, as the site seeds its lists. */
export function inkOf(name: string): number {
  const seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  return TURN[seed % TURN.length]
}

/** The ink of the nth of a list, as areas take theirs in the turn. */
export const nth = (n: number): number => TURN[n % TURN.length]

/** A pair the specimen draws and what WCAG AA asks of it: 4.5:1 for
 * text, 3:1 for an icon or a ring. */
export type Pair = { what: string; ratio: number; floor: number }

/** Every pair an ink draws in a theme, measured. */
export function pairs(ink: number, t: Theme): Pair[] {
  const wash = tone(ROLES.wash, ink, t)
  const mark = tone(ROLES.mark, ink, t)
  return [
    { what: 'text on fill', ratio: contrast(ON_FILL, tone(ROLES.fill, ink, t)), floor: 4.5 },
    { what: 'text on wash', ratio: contrast(tone(ROLES.onWash, ink, t), wash), floor: 4.5 },
    { what: 'body text on wash', ratio: contrast(shade(SHADES.text, t), wash), floor: 4.5 },
    { what: 'mark on panel', ratio: contrast(mark, shade(SHADES.panel, t)), floor: 3 },
    { what: 'mark on ground', ratio: contrast(mark, shade(SHADES.ground, t)), floor: 3 },
    { what: 'mark on wash', ratio: contrast(mark, wash), floor: 3 },
  ]
}

/** The pair a role draws, by its name in `pairs`. */
export const pair = (ink: number, t: Theme, what: string): Pair => pairs(ink, t).find((p) => p.what === what)!

/** A ratio as the specimen states it. */
export const ratio = (r: number): string => `${r.toFixed(1)}:1`
