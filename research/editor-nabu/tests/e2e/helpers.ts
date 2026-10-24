import { expect, type Page } from '@playwright/test'

export type Side = 'a' | 'b'
export const shots = '/home/ixxie/.claude/jobs/83da3889/tmp/editor-nabu-shots'

export const editor = (page: Page, side: Side) => page.locator(`[data-side=${side.toUpperCase()}] .nabu-editor`)

export async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('converged')).toHaveText('Converged')
}

// Put the caret in the block whose text starts with `text`, at `offset`.
export async function caret(page: Page, side: Side, text: string, offset = -1) {
  await editor(page, side).focus()
  await page.evaluate(
    ([side, text, offset]) => {
      const s = (globalThis as any).pair[side]
      const block = [...s.engine.blocks.values()].find((b: any) => b.element && s.root.contains(b.element) && b.text?.startsWith(text))
      if (!block) {
        throw new Error(`no block starting "${text}"`)
      }
      s.engine.selection.setCursor(block, offset < 0 ? block.text.length : offset)
    },
    [side, text, offset] as const,
  )
  await page.waitForTimeout(50)
}

// Select from one block's offset to another's.
export async function select(page: Page, side: Side, from: [string, number], to: [string, number]) {
  await editor(page, side).focus()
  await page.evaluate(
    ([side, from, to]) => {
      const s = (globalThis as any).pair[side]
      const find = (t: string) => [...s.engine.blocks.values()].find((b: any) => b.element && s.root.contains(b.element) && b.text?.startsWith(t))
      const p = find(from[0]).getDOMPoint(from[1])
      const q = find(to[0]).getDOMPoint(to[1])
      getSelection()!.setBaseAndExtent(p.node, p.offset, q.node, q.offset)
    },
    [side, from, to] as const,
  )
  await page.waitForTimeout(50)
}

// The canonical blocks of one side, flattened to [type, text, depth].
export async function blocks(page: Page, side: Side): Promise<[string, string, number][]> {
  // Some of nabu's edits commit in two steps, a tick apart.
  await page.waitForTimeout(30)
  return page.evaluate((side) => {
    const out: [string, string, number][] = []
    const walk = (bs: any[], depth: number) => {
      for (const b of bs) {
        out.push([b.type, (b.text ?? []).map((r: any) => r.text).join(''), depth])
        walk(b.children ?? [], depth + 1)
      }
    }
    walk(JSON.parse((globalThis as any).pair[side].json).blocks, 0)
    return out
  }, side)
}

// The canonical runs of the first block whose text starts with `start`.
export async function runs(page: Page, side: Side, start: string) {
  return page.evaluate(
    ([side, start]) => {
      const find = (bs: any[]): any => {
        for (const b of bs) {
          const text = (b.text ?? []).map((r: any) => r.text).join('')
          if (text.startsWith(start)) {
            return b.text
          }
          const hit = find(b.children ?? [])
          if (hit) {
            return hit
          }
        }
      }
      return find(JSON.parse((globalThis as any).pair[side].json).blocks)
    },
    [side, start] as const,
  )
}

// The caret as [block text, offset] on one side.
export async function where(page: Page, side: Side): Promise<[string, number] | null> {
  // nabu reads the selection on selectionchange, which fires a task later.
  await page.waitForTimeout(30)
  return page.evaluate((side) => {
    const s = (globalThis as any).pair[side]
    const b = s.engine.selection.anchorBlock
    const sel = b?.behaviors?.get('text')?.selection
    return b && sel ? [b.text, sel.from] : null
  }, side)
}

export async function converged(page: Page) {
  await expect(page.getByTestId('converged')).toHaveText('Converged')
  const [a, b] = await page.evaluate(() => [(globalThis as any).pair.a.hash, (globalThis as any).pair.b.hash])
  expect(a).toBe(b)
}
