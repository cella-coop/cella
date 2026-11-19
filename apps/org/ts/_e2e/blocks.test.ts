// The block kinds specimen (`/specimens/blocks`), in every browser: each
// of the kit's own presentational block components draws, read-only,
// with no editing behaviour and no script error. `SHOTS` names where its
// screenshots go. Run by `cella test e2e blocks`.
// covers: core

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-blocks-shots'

eachBrowser((name, launch) => {
  test(`${name}: the block kinds specimen draws every presentational block, read-only`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 900, height: 1400 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, 'camille@lanterne.example')
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/specimens/blocks`)
      await page.waitForLoadState('networkidle')

      await page.getByRole('heading', { level: 2, name: 'Heading 1' }).waitFor()
      await page.getByRole('heading', { level: 3, name: 'Heading 2' }).waitFor()
      await page.getByRole('heading', { level: 4, name: 'Heading 3' }).waitFor()
      assert.ok(await page.getByText('A paragraph: plain text, nothing else to its shape.').isVisible())
      assert.equal(await page.locator('ul.list').count(), 1, 'the bulleted list is a native list')
      assert.equal(await page.locator('ol.list').count(), 1, 'the numbered list is a native list')
      assert.equal(await page.locator('li.item').count(), 5, 'three bulleted and two numbered items')
      assert.ok(await page.getByRole('checkbox', { name: 'Done' }).first().isVisible(), 'the to-do is the UI core\'s own checkbox, never the browser\'s')
      assert.equal(await page.locator('input[type="checkbox"]').count(), 0, 'never a native checkbox')
      assert.ok(await page.getByText('A quote, set apart by its rule.').isVisible())
      assert.ok(await page.getByText('title = "Specimen"').isVisible())
      assert.equal(await page.locator('.divider hr').count(), 1)
      assert.equal(await page.locator('.embed .card').count(), 1)
      assert.equal(await page.locator('.embed .unknown').count(), 1)

      await page.screenshot({ path: `${shots}/blocks-${name}.png`, fullPage: true })
      assert.deepEqual(errors, [], 'the page threw nothing')
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
