// The asset library's parts (index.md, the assets): each a page of
// `/assets` in the dev server alone, named by an identifier, never copy.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export const PARTS = [
  { name: 'photos', icon: 'images' },
  { name: 'diagrams', icon: 'flow-arrow' },
  { name: 'icons', icon: 'shapes' },
  { name: 'components', icon: 'squares-four' },
] as const

export type Part = (typeof PARTS)[number]['name']

export const nav = PARTS.map((p) => ({ label: p.name, href: `/assets/${p.name}` }))

/** Every vendored photo's name, in order. */
export function photoNames(): string[] {
  try {
    return readdirSync(join(process.cwd(), 'src/photos'))
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.slice(0, -4))
      .sort()
  } catch {
    return []
  }
}
