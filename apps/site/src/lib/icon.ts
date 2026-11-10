import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

/** A Phosphor icon's paths alone, in its regular weight or filled, for an
 * SVG that places and colours them. */
export function glyphPaths(name: string, weight: 'regular' | 'fill' = 'regular'): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`unknown Phosphor icon: ${name}`)
  }
  try {
    const file = weight === 'fill' ? `fill/${name}-fill` : `regular/${name}`
    const path = createRequire(import.meta.url).resolve(`@phosphor-icons/core/assets/${file}.svg`)
    return readFileSync(path, 'utf8').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')
  } catch {
    throw new Error(`unknown Phosphor icon: ${name}`)
  }
}

// A role's colours, or `current`, the text's own colour around it, its
// duotone layer a fifth of it, for an icon on a band
export type IconRole = 'accent' | 'success' | 'error' | 'warning' | 'info' | 'help' | 'current'
export function iconMarkup(name: string, role: IconRole): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`unknown Phosphor duotone icon: ${name}`)
  if (!['accent', 'success', 'error', 'warning', 'info', 'help', 'current'].includes(role)) throw new Error(`unknown icon role: ${role}`)
  let svg: string
  try {
    const path = createRequire(import.meta.url).resolve(`@phosphor-icons/core/assets/duotone/${name}-duotone.svg`)
    svg = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`unknown Phosphor duotone icon: ${name}`)
  }
  const marked = svg.replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" focusable="false" ')
  if (role === 'current') {
    return marked
  }
  return marked
    .replace('fill="currentColor"', `fill="var(--${role}-text)"`)
    .replaceAll('opacity="0.2"', `fill="var(--${role}-soft)" opacity="1"`)
}
