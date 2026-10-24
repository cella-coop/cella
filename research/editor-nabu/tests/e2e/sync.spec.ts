import { expect, test } from '@playwright/test'
import { blocks, caret, converged, editor, open, shots, where } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await open(page)
})

const remote = (page: import('@playwright/test').Page, text: string, edits: [number | 'end', string][]) =>
  page.evaluate(
    ([text, edits]) => {
      const b = (globalThis as any).pair.b
      const block = [...b.engine.blocks.values()].find((x: any) => x.text === text)
      for (const [at, s] of edits) {
        block.behavior.insert(at === 'end' ? block.behavior.container.length : at, s)
      }
      b.engine.commit()
    },
    [text, edits] as const,
  )

test('a remote edit in the block holding the caret does not move it', async ({ page }) => {
  const item = 'Day of work, per day: 560 € standard, 380 € solidarity'
  await caret(page, 'a', 'Day of work', 11)
  await remote(page, item, [
    [0, 'NEW '],
    ['end', ' (2027)'],
  ])
  await expect(editor(page, 'a')).toContainText('NEW Day of work')
  expect(await where(page, 'a')).toEqual([`NEW ${item} (2027)`, 15])
  await page.keyboard.type('Q')
  expect(await blocks(page, 'b')).toContainEqual(['bullet', `NEW Day of workQ, per day: 560 € standard, 380 € solidarity (2027)`, 0])
  await converged(page)
})

test('a remote edit elsewhere leaves the caret alone', async ({ page }) => {
  await caret(page, 'a', 'Services', 4)
  await remote(page, 'Rate card 2027', [[0, 'Draft: ']])
  expect(await where(page, 'a')).toEqual(['Services', 4])
  await page.keyboard.type('X')
  expect(await blocks(page, 'b')).toContainEqual(['heading', 'ServXices', 0])
})

test('offline edits on both sides merge when back online', async ({ page }) => {
  await page.getByTestId('online').uncheck()
  await caret(page, 'a', 'Services')
  await page.keyboard.type(' (A)')
  await caret(page, 'b', 'Services')
  await page.keyboard.type(' (B)')
  await caret(page, 'b', 'Website', 3)
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('converged')).toHaveText('Diverged')
  await page.getByTestId('online').check()
  await converged(page)
  const heading = (await blocks(page, 'a')).find(([t, x]) => t === 'heading' && x.startsWith('Services'))
  expect(heading?.[1]).toMatch(/^Services \((A|B)\) \((A|B)\)$/)
})

test('IME composition commits once, through CDP', async ({ page }) => {
  await caret(page, 'a', 'Services')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: 'か', selectionStart: 1, selectionEnd: 1 })
  await cdp.send('Input.imeSetComposition', { text: 'かな', selectionStart: 2, selectionEnd: 2 })
  await cdp.send('Input.insertText', { text: '仮名' })
  await page.waitForTimeout(100)
  expect(await blocks(page, 'a')).toContainEqual(['heading', 'Services仮名', 0])
  await expect(editor(page, 'a').locator('h2')).toHaveText('Services仮名')
  await page.keyboard.type('!')
  expect(await blocks(page, 'b')).toContainEqual(['heading', 'Services仮名!', 0])
  await converged(page)
})

test('a remote edit during a composition waits for it to end', async ({ page }) => {
  await caret(page, 'a', 'Services')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: 'か', selectionStart: 1, selectionEnd: 1 })
  await remote(page, 'Services', [[0, 'Our ']])
  await cdp.send('Input.insertText', { text: '仮' })
  await page.waitForTimeout(100)
  expect(await blocks(page, 'a')).toContainEqual(['heading', 'Our Services仮', 0])
  await expect(editor(page, 'a').locator('h2')).toHaveText('Our Services仮')
  await converged(page)
})

test('drag a block by its handle, and a list item out of its list', async ({ page }) => {
  const box = async (text: string) => (await editor(page, 'a').locator('[data-block-id]', { hasText: text }).last().boundingBox())!
  const drag = async (from: string, to: string, after: boolean) => {
    const f = await box(from)
    await page.mouse.move(f.x + 20, f.y + 5)
    await page.mouse.move(f.x + 10, f.y + 5)
    const handle = page.locator('button.drag')
    await expect(handle).toBeVisible()
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + 5, h.y + 5)
    await page.mouse.down()
    const t = await box(to)
    await page.mouse.move(t.x + 30, after ? t.y + t.height - 3 : t.y + 3, { steps: 8 })
    await page.mouse.up()
  }
  await drag('Nuvola renews', 'Rate card 2027', true)
  let all = (await blocks(page, 'a')).map(([t]) => t)
  expect(all.slice(0, 2)).toEqual(['heading', 'quote'])
  await drag('Website', 'Prices are', true)
  all = (await blocks(page, 'a')).map(([t]) => t)
  expect(all.slice(0, 4)).toEqual(['heading', 'quote', 'paragraph', 'bullet'])
  await converged(page)
})

test('screenshots, light and dark', async ({ page }) => {
  await caret(page, 'a', 'Prices are')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await page.screenshot({ path: `${shots}/light-slash.png` })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.evaluate(() => {
    const s = (globalThis as any).pair.b
    const block = [...s.engine.blocks.values()].find((x: any) => x.text?.startsWith('Prices'))
    const p = block.getDOMPoint(0)
    const q = block.getDOMPoint(15)
    s.root.querySelector('.nabu-editor').focus()
    getSelection()!.setBaseAndExtent(p.node, p.offset, q.node, q.offset)
  })
  await page.waitForTimeout(100)
  await page.screenshot({ path: `${shots}/light.png`, fullPage: true })
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'))
  await page.waitForTimeout(100)
  await page.screenshot({ path: `${shots}/dark.png`, fullPage: true })
  await page.getByTestId('online').uncheck()
  await caret(page, 'b', 'Services')
  await page.keyboard.type(' offline')
  await page.screenshot({ path: `${shots}/dark-diverged.png` })
})
