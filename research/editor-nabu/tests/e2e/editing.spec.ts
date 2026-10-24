import { expect, test } from '@playwright/test'
import { blocks, caret, converged, editor, open, runs, select, where } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await open(page)
})

test('typing lands in the model and on the other side', async ({ page }) => {
  await caret(page, 'a', 'Services')
  await page.keyboard.type(' we offer')
  expect(await blocks(page, 'b')).toContainEqual(['heading', 'Services we offer', 0])
  await expect(editor(page, 'b')).toContainText('Services we offer')
  await converged(page)
})

test('Enter splits a block and Backspace joins it again', async ({ page }) => {
  await caret(page, 'a', 'Prices are', 10)
  await page.keyboard.press('Enter')
  let all = await blocks(page, 'a')
  expect(all[1]).toEqual(['paragraph', 'Prices are', 0])
  expect(all[2][1].startsWith(' per unit')).toBe(true)
  expect(await where(page, 'a')).toEqual([all[2][1], 0])
  await page.keyboard.press('Backspace')
  all = await blocks(page, 'a')
  expect(all[1][1].startsWith('Prices are per unit')).toBe(true)
  expect(await where(page, 'a')).toEqual([all[1][1], 10])
  await converged(page)
})

test('Delete at the end of a block pulls the next one in', async ({ page }) => {
  await caret(page, 'a', 'Rate card 2027')
  await page.keyboard.press('Delete')
  expect((await blocks(page, 'a'))[0][1].startsWith('Rate card 2027Prices')).toBe(true)
})

test('arrow keys cross block boundaries', async ({ page }) => {
  await caret(page, 'a', 'Rate card 2027')
  await page.keyboard.press('ArrowRight')
  expect((await where(page, 'a'))?.[0].startsWith('Prices')).toBe(true)
  await page.keyboard.press('ArrowLeft')
  expect(await where(page, 'a')).toEqual(['Rate card 2027', 14])
  await page.keyboard.press('ArrowDown')
  expect((await where(page, 'a'))?.[0].startsWith('Prices')).toBe(true)
})

test('markdown shortcuts: heading and bullet', async ({ page }) => {
  await caret(page, 'a', 'Prices are')
  await page.keyboard.press('Enter')
  await page.keyboard.type('## Terms')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- first')
  const all = await blocks(page, 'a')
  expect(all).toContainEqual(['heading', 'Terms', 0])
  expect(all).toContainEqual(['bullet', 'first', 0])
  await converged(page)
})

test('the slash menu turns a block into a heading and inserts a decision', async ({ page }) => {
  await caret(page, 'a', 'Prices are')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/head')
  await expect(page.locator('.nabu-slash')).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Terms')
  expect(await blocks(page, 'a')).toContainEqual(['heading', 'Terms', 0])
  await page.keyboard.type(' /deci')
  await page.keyboard.press('Enter')
  await expect(editor(page, 'a').locator('[data-block-type=decision]')).toHaveCount(2)
  await expect(editor(page, 'b').locator('[data-block-type=decision]')).toHaveCount(2)
  await converged(page)
})

test('Tab nests a list item and Shift-Tab lifts it', async ({ page }) => {
  const website = 'Website, per project: from 12 000 € / from 7 500 €'
  await caret(page, 'a', 'Website', 3)
  await page.keyboard.press('Tab')
  expect(await blocks(page, 'a')).toContainEqual(['bullet', website, 1])
  expect(await where(page, 'a')).toEqual([website, 3])
  await page.keyboard.press('Shift+Tab')
  expect(await blocks(page, 'a')).toContainEqual(['bullet', website, 0])
  await converged(page)
})

test('a selection across blocks deletes as one', async ({ page }) => {
  await select(page, 'a', ['Prices are', 6], ['Day of work', 4])
  await page.keyboard.press('Backspace')
  const all = await blocks(page, 'a')
  expect(all[1]).toEqual(['paragraph', 'Pricesof work, per day: 560 € standard, 380 € solidarity', 0])
  expect(all.some(([, t]) => t === 'Services')).toBe(false)
  await converged(page)
})

test('Cmd-B bolds, Cmd-K links, the toolbar shows over a selection', async ({ page }) => {
  await select(page, 'a', ['Prices are', 0], ['Prices are', 6])
  await expect(page.locator('.toolbar')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+b')
  expect((await runs(page, 'a', 'Prices'))[0]).toEqual({ text: 'Prices', marks: { bold: true } })
  await select(page, 'a', ['Prices are', 7], ['Prices are', 10])
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByLabel('Link address').fill('https://lanterne.example/rates')
  await page.keyboard.press('Enter')
  expect(await runs(page, 'b', 'Prices')).toContainEqual({ text: 'are', marks: { link: 'https://lanterne.example/rates' } })
  await converged(page)
})

test('undo reverts only local edits', async ({ page }) => {
  await caret(page, 'b', 'Services')
  await page.keyboard.type('!')
  await caret(page, 'a', 'Rate card 2027')
  await page.keyboard.type('X')
  await page.keyboard.press('ControlOrMeta+z')
  const all = await blocks(page, 'a')
  expect(all[0][1]).toBe('Rate card 2027')
  expect(all).toContainEqual(['heading', 'Services!', 0])
})

test('pasting text inserts text; pasting markdown inserts blocks', async ({ page }) => {
  await caret(page, 'a', 'Prices are')
  const paste = (text: string) =>
    page.evaluate((text) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, text)
  await paste(' (excl. VAT)')
  expect((await blocks(page, 'a'))[1][1].endsWith('intérieur. (excl. VAT)')).toBe(true)
  await page.keyboard.press('Enter')
  await paste('- one\n- two')
  const all = await blocks(page, 'a')
  expect(all).toContainEqual(['bullet', 'one', 0])
  expect(all).toContainEqual(['bullet', 'two', 0])
  await converged(page)
})

test('copying a multi-block selection carries nabu JSON and markdown', async ({ page }) => {
  await select(page, 'a', ['Services', 0], ['Brand identity', 5])
  const data = await page.evaluate(() => {
    const dt = new DataTransfer()
    document.activeElement!.dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true }))
    return { md: dt.getData('text/plain'), json: dt.getData('application/x-nabu+json') }
  })
  expect(data.md).toContain('Services')
  expect(data.md).toContain('- Day of work')
  expect(JSON.parse(data.json).blocks.length).toBeGreaterThan(1)
})

test('Alt-Shift-Arrow moves the selected blocks', async ({ page }) => {
  await caret(page, 'a', 'Nuvola renews', 2)
  await page.keyboard.press('Alt+Shift+ArrowUp')
  const top = (await blocks(page, 'a')).filter(([, , d]) => d === 0).map(([t]) => t)
  expect(top.indexOf('quote')).toBeLessThan(top.indexOf('decision'))
  expect((await where(page, 'a'))?.[0].startsWith('Nuvola')).toBe(true)
  await converged(page)
})
