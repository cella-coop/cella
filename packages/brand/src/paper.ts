// The paper: one SVG turbulence tile per layer, the newsprint's grain and
// its fibres, inked in the text's colour and worn by each surface at its
// strength. The same speck reads louder on dark paper than on light, so
// dark wears it at a fraction.

import { rgb8 } from './color.ts'
import type { House, Layer } from './house.ts'
import { role, type Theme } from './tones.ts'

export const SURFACES = ['ground', 'panel', 'raised'] as const
export type Surface = (typeof SURFACES)[number]

/** One layer's tile as a CSS url(), at a strength. */
export function noiseUri(house: House, layer: Layer, strength: number, ink: [number, number, number] | null): string {
  const sc = house.paper.scale
  const tile = Math.round(layer.tile * sc)
  const alpha = +(layer.alpha * strength).toFixed(4)
  const colour = ink
    ? `<feColorMatrix type='matrix' values='0 0 0 0 ${(ink[0] / 255).toFixed(3)} 0 0 0 0 ${(ink[1] / 255).toFixed(3)} 0 0 0 0 ${(ink[2] / 255).toFixed(3)} 1 0 0 0 0'/>`
    : `<feColorMatrix type='saturate' values='0'/>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tile}' height='${tile}'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='${layer.type}' baseFrequency='${+(layer.fx / sc).toFixed(4)} ${+(layer.fy / sc).toFixed(4)}' numOctaves='${layer.oct}' seed='${layer.seed}' stitchTiles='stitch'/>${colour}<feComponentTransfer><feFuncA type='gamma' amplitude='${alpha}' exponent='${layer.exp}' offset='0'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`
}

/** A surface's paper in a theme: its layers as one background-image, or
    none. */
export function grain(house: House, surface: Surface, t: Theme): string {
  const strength = (house.paper.on[surface] ?? 0) * house.paper.amount * (t < 0 ? house.paper.dark : 1)
  if (strength <= 0) {
    return 'none'
  }
  const ink = house.paper.ink === 'ink' ? rgb8(role(house, 'text', t).oklch) : house.paper.ink === 'accent' ? rgb8(role(house, 'accent-text', t).oklch) : null
  const parts = Object.values(house.paper.layers)
    .filter((l) => l.on && l.alpha > 0)
    .map((l) => noiseUri(house, l, strength, ink))
  return parts.length ? parts.join(', ') : 'none'
}
