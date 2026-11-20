// The week's grid behind the timesheets' New button, in every browser:
// signed in as Thomas on the dev server, the dialog shows the whole week,
// Monday to Sunday, within its own bounds, and lists his projects alone,
// those of the circles he sits in and those he booked to, never Brand's.
// Nothing is written. Run by `cella test e2e week`.
// covers: employment-project-timesheet

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eachBrowser, serve, signIn } from './browser.ts'

const thomas = 'thomas@lanterne.example'

eachBrowser((browserName, launch) => {
  test(`${browserName}: the week's dialog shows every day and only Thomas's projects`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, thomas)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/timesheets`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: /^New(?! (accordion|group))/ }).click()
      const dialog = page.locator('dialog[open]')
      const grid = dialog.locator('table.grid')
      await grid.waitFor()

      const box = (await dialog.boundingBox())!
      const heads = grid.locator('thead th[scope="col"]')
      const days = (await heads.allInnerTexts()).map((t) => t.split('\n')[0].trim())
      for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
        assert.ok(days.includes(day), `the grid heads ${day}`)
        const at = (await heads.filter({ hasText: day }).first().boundingBox())!
        assert.ok(at.x >= box.x && at.x + at.width <= box.x + box.width, `${day} sits within the dialog`)
      }

      const rows = (await grid.locator('tbody th').allInnerTexts()).map((t) => t.trim())
      assert.ok(rows.includes('Les Halles Paysannes, online shop'), 'the shop he works on, Web\'s, is listed')
      assert.ok(!rows.includes('Maison Ferrand, packaging'), 'Brand\'s packaging, never his, is not')
      assert.equal(rows.at(-1), 'The coop’s own time')
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
      await stop()
    }
  })
})
