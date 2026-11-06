import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

export type IconRole = 'accent' | 'success' | 'error' | 'warning' | 'info' | 'help'
export function iconMarkup(name: string, role: IconRole): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`unknown Phosphor duotone icon: ${name}`)
  if (!['accent', 'success', 'error', 'warning', 'info', 'help'].includes(role)) throw new Error(`unknown icon role: ${role}`)
  let svg: string
  try {
    const path = createRequire(import.meta.url).resolve(`@phosphor-icons/core/assets/duotone/${name}-duotone.svg`)
    svg = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`unknown Phosphor duotone icon: ${name}`)
  }
  return svg.replace('<svg ', '<svg width="100%" height="100%" aria-hidden="true" focusable="false" ')
    .replace('fill="currentColor"', `fill="var(--${role}-text)"`)
    .replaceAll('opacity="0.2"', `fill="var(--${role}-soft)" opacity="1"`)
}
