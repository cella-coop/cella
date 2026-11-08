// The tone and shade model: a tone is a chroma and a hue, a shade a
// lightness mirrored around the midpoint by one sign, the theme (1 light,
// -1 dark), and every role a shade of a tone. Dark compresses the
// surfaces' rungs, since an equal step reads stronger near black, and
// depth draws them together or apart.

import { clamp, type Oklch } from './color.ts'
import { inkAction, type House, type ToneName } from './house.ts'

export type Theme = 1 | -1

/** The sheet's ladder, shade 0 (the panel) to shade 9 (the text). */
export const K = [0.39, 0.355, 0.32, 0.27, 0.19, 0.06, -0.1, -0.17, -0.27, -0.36]
/** Dark's surfaces, shades 0 to 3, before depth spreads them. */
export const DARK = [0.215, 0.245, 0.185, 0.28]
/** The well's rung. */
const SUNK = 0.3

/** A shade's rung, the surfaces' spread by depth. */
export const rung = (house: House, i: number): number => (i < 4 ? K[0] - (K[0] - K[i]) * house.depth : K[i])

/** Whether a shade is one dark sets apart, a compressed surface. */
export const compressed = (house: House, i: number): boolean => house.compress && i < 4

export function shades(house: House, t: Theme): number[] {
  return K.map((_, i) => {
    if (t < 0 && compressed(house, i)) {
      const dark = DARK[0] + (DARK[i] - DARK[0]) * house.depth
      return clamp(house.mid + (dark - 0.58) * house.contrast)
    }
    return clamp(house.mid + t * house.contrast * rung(house, i))
  })
}

export const sunkRung = (house: House): number => K[0] - (K[0] - SUNK) * house.depth

export const sunkL = (house: House, t: Theme): number => clamp(house.mid + t * house.contrast * sunkRung(house))

/** A role's lightness: a shade, the well, or the action's. */
export type Lightness = number | 'sunk' | 'action' | 'on-action'

/** A role: its lightness, its tone, and an alpha for a tint. */
export type Role = { l: Lightness; tone: ToneName; alpha?: 'hover' | 'soft' | 'accent-soft' }

/** The roles, as the explorer's :root rules compose them. Components
    read these, never a shade. */
export const ROLES: Record<string, Role> = {
  ground: { l: 2, tone: 'base' },
  panel: { l: 0, tone: 'base' },
  raised: { l: 1, tone: 'base' },
  sunk: { l: 'sunk', tone: 'base' },
  float: { l: 0, tone: 'base' },
  line: { l: 3, tone: 'base' },
  hover: { l: 3, tone: 'base', alpha: 'hover' },
  text: { l: 9, tone: 'base' },
  'text-muted': { l: 7, tone: 'base' },
  'text-subtle': { l: 6, tone: 'base' },
  'accent-fill': { l: 'action', tone: 'accent' },
  'accent-border': { l: 6, tone: 'accent' },
  'accent-text': { l: 8, tone: 'accent' },
  'accent-soft': { l: 3, tone: 'accent', alpha: 'accent-soft' },
  'accent-ring': { l: 4, tone: 'accent' },
  'on-accent': { l: 'on-action', tone: 'base' },
  'success-text': { l: 8, tone: 'success' },
  'success-soft': { l: 3, tone: 'success', alpha: 'soft' },
  'error-text': { l: 8, tone: 'error' },
  'error-soft': { l: 3, tone: 'error', alpha: 'soft' },
  'warning-text': { l: 8, tone: 'warning' },
  'warning-soft': { l: 3, tone: 'warning', alpha: 'soft' },
  'info-text': { l: 8, tone: 'info' },
  'info-soft': { l: 3, tone: 'info', alpha: 'soft' },
  'help-text': { l: 8, tone: 'help' },
  'help-soft': { l: 3, tone: 'help', alpha: 'soft' },
}

/** A tint's alpha in a theme. */
export function alpha(kind: NonNullable<Role['alpha']>, t: Theme): number {
  return kind === 'hover' ? 0.6 : kind === 'soft' ? 0.46 + t * 0.14 : 0.4 + t * 0.15
}

/** The action's fill: the text's lightness when the action is ink, in
    either theme, else the house's fixed one. */
export const actionL = (house: House, t: Theme): number => (inkAction(house) ? shades(house, t)[9] : house.accentL)

/** What sits on the action: the panel's lightness when it is ink. */
export const onActionL = (house: House, t: Theme): number => (inkAction(house) ? shades(house, t)[0] : shades(house, 1)[0])

export function lightness(house: House, l: Lightness, t: Theme): number {
  return l === 'sunk' ? sunkL(house, t) : l === 'action' ? actionL(house, t) : l === 'on-action' ? onActionL(house, t) : shades(house, t)[l]
}

/** A role's colour in a theme, and its alpha where it is a tint. */
export function role(house: House, name: string, t: Theme): { oklch: Oklch; alpha: number } {
  const r = ROLES[name]
  const { c, h } = house.tones[r.tone]
  return { oklch: [lightness(house, r.l, t), c, h], alpha: r.alpha ? alpha(r.alpha, t) : 1 }
}

/** The five inks, at the house's fixed lightness, in the pentad's order. */
export const inks = (house: House, hs: number[]): Oklch[] => hs.map((h) => [house.accentL, house.inkC, h])
