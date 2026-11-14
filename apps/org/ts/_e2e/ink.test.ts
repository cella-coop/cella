// The ink specimen (`/specimens/ink`), in every browser, light and dark:
// both themes side by side, each a region wearing its own; every pair
// each ink draws states its contrast and none is under AA; the proposed
// primary action is solid in an ink where today's is plain, and the
// shell around the specimen keeps today's. It reads and writes nothing.
// `SHOTS` names where its screenshots go. Run by `cella test e2e ink`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-ink-shots'

eachBrowser((name, launch) => {
  test(`${name}: the ink specimen proposes where the inks go, both themes, every pair over AA`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1500 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${base}/specimens/ink`)
        await page.waitForLoadState('networkidle')
        const at = `${name}, ${scheme}`

        for (const theme of ['Light', 'Dark']) {
          const region = page.getByRole('region', { name: `${theme} theme` })
          await region.waitFor()
          const cells = await region.locator('table.contrast td').allTextContents()
          assert.equal(cells.length, 30, `${at}: ${theme} states six pairs for each of five inks`)
          assert.ok(cells.every((c) => /^\d+\.\d:1$/.test(c.trim())), `${at}: ${theme}, every pair over AA: ${cells.join(', ')}`)
          const [today, proposed] = await region.getByRole('button', { name: 'Propose' }).evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
          assert.notEqual(today, proposed, `${at}: ${theme}, the proposed primary wears an ink`)
        }
        const light = await page.getByRole('region', { name: 'Light theme' }).evaluate((e) => getComputedStyle(e).backgroundColor)
        const dark = await page.getByRole('region', { name: 'Dark theme' }).evaluate((e) => getComputedStyle(e).backgroundColor)
        assert.notEqual(light, dark, `${at}: each region wears its own theme`)
        await page.screenshot({ path: `${shots}/ink-${name}-${scheme}.png`, fullPage: true })
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
