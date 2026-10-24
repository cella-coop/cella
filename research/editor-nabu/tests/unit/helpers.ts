import type { Nabu } from '@aionbuilders/nabu'
import { LoroDoc } from 'loro-crdt'
import { tick } from 'svelte'
import { tree, type Block } from '../../src/lib/canonical.ts'
import { engine } from '../../src/lib/editor/engine.ts'
import { seed, type Seed } from '../../src/lib/seed.ts'

export const t = (insert: string, attributes?: Record<string, unknown>) => (attributes ? { insert, attributes } : { insert })

export function make(blocks?: Seed[]): Nabu {
  return engine(seed(blocks))
}

export const sel = (from: number, to = from) => ({ from, to, isCollapsed: from === to, direction: 'none' as const })
export const ev = (inputType = '', data: string | null = null) => ({ inputType, data, preventDefault() {}, getTargetRanges: () => [] }) as any

// Every block nabu holds, depth first, in document order.
export function all(nabu: Nabu): any[] {
  const out: any[] = []
  const walk = (bs: any[]) => {
    for (const b of bs) {
      out.push(b)
      walk(b.children ?? [])
    }
  }
  walk(nabu.children)
  return out
}

export const byText = (nabu: Nabu, text: string) => all(nabu).find((b) => b.text === text)

export const shape = (nabu: Nabu): Block[] => tree(nabu.doc)

export async function settle() {
  await Promise.resolve()
  await tick()
}

export function fresh() {
  return new LoroDoc()
}
