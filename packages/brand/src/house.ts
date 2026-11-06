// The explorer's settings, house.json, read as the explorer reads them:
// laid over its defaults, the five status hues derived from the phase and
// the step, and the action's tone. The brand has no accent: an action is
// ink, so the accent tone is the paper's.

export type Tone = { c: number; h: number }
export type Face = { family: string; axes: Record<string, number> }
export type Layer = { on: boolean; type: string; fx: number; fy: number; oct: number; alpha: number; exp: number; tile: number; seed: number }
export type Mark = {
  style: 'voronoi' | 'pinwheel' | 'strip'
  spread: number
  r: number
  rot: number
  gutter: number
  l: number
  c: number
  case: 'caps' | 'title'
  lockup: 'row' | 'stack'
  weight: number
  track: number
  scale: number
  gap: number
  cells?: number
  jitter?: number
  seed?: number
  round?: number
  core?: number
  slant: number
  bandGap: number
}

export const PENTAD = ['error', 'warning', 'success', 'info', 'help'] as const
export type Status = (typeof PENTAD)[number]
export const TONES = ['base', 'accent', ...PENTAD] as const
export type ToneName = (typeof TONES)[number]

export type House = {
  action: string
  compress: boolean
  mid: number
  contrast: number
  depth: number
  accentL: number
  phase: number
  step: number
  statusC: number
  tones: Record<ToneName, Tone>
  fonts: { display: Face; text: Face; mono: Face }
  scale: { base: number; ratio: number; leading: number; track: number }
  paper: {
    ink: 'ink' | 'grey' | 'accent'
    blend: string
    on: { ground: number; panel: number; raised: number }
    layers: Record<string, Layer>
    amount: number
    scale: number
    dark: number
  }
  mark: Mark
}

/** The action is ink, not a tone of its own. */
export const inkAction = (house: House): boolean => ['ink', 'strip', 'halftone'].includes(house.action)

/** The brand as the explorer resolves it from house.json. */
export function resolve(json: unknown): House {
  /* what house.json may leave to the explorer's defaults */
  type Paper = House['paper']
  type Raw = Omit<House, 'depth' | 'paper'> & { depth?: number; paper: Omit<Paper, 'amount' | 'scale' | 'dark'> & Partial<Paper> }
  const raw = structuredClone(json) as Raw
  const house: House = {
    ...raw,
    depth: raw.depth ?? 1,
    paper: { amount: 1, scale: 1, dark: 0.5, ...raw.paper },
  }
  PENTAD.forEach((k, i) => {
    house.tones[k] = { c: house.statusC, h: Math.round((house.phase + i * house.step) % 360) }
  })
  house.tones.accent = inkAction(house) ? { ...house.tones.base } : { ...house.tones[house.action as ToneName] }
  return house
}

/** The five hues, in the pentad's order. */
export const hues = (house: House): number[] => PENTAD.map((k) => house.tones[k].h)
