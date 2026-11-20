// The record icon scenario, in Chromium, on a seeded Lanterne through the
// dev server: before anything is picked, the Shop's project wears its
// collection's icon, Briefcase, in its header and on its card on the
// Projects board, as every project does. Yusuf, Web's lead, picks Rocket
// from the curated grid by the Details drawer's Icon property, and both
// change to it, in the project's own ink; clearing it, with the grid's
// None, takes it away from both, back to Briefcase, as before. `SHOTS`
// names where its screenshots go. Run by `cella test e2e record-icon`.
// covers: project

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Locator } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-record-icon-shots'
const yusuf = 'yusuf@lanterne.example'
const title = 'Les Halles Paysannes, online shop'

// The mark's SVG, read fresh each time, its hydration comments stripped
// (Svelte places them differently by its nesting, never by its icon): a
// bare presence check cannot tell Briefcase from Rocket, so the scenario
// compares the paths it draws.
const markOf = async (locator: Locator) => (await locator.locator('.mark svg').innerHTML()).replace(/<!--.*?-->/gs, '')

eachBrowser((name, launch) => {
  test(`${name}: Yusuf picks a project's own icon, sees it replace the collection's, and clears it back`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, yusuf)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))

      await page.goto(`${base}/projects/halles-shop`)
      await page.waitForLoadState('networkidle')
      const h1 = page.getByRole('heading', { level: 1 }).filter({ hasText: title })
      await h1.locator('.mark').waitFor()
      const briefcase = await markOf(h1)

      await page.getByRole('tab', { name: 'Details' }).click()
      const drawer = page.getByRole('complementary', { name: 'Details' })
      // A project with no icon lists none; Add property offers it, and
      // choosing it opens its popover.
      await drawer.getByRole('button', { name: 'Add property' }).click()
      await page.getByRole('option', { name: 'Icon', exact: true }).click()
      const grid = page.getByRole('dialog', { name: 'Icon', exact: true })
      await grid.waitFor()
      await grid.getByRole('textbox', { name: 'Search icons' }).fill('Rocket')
      await grid.getByRole('menuitemradio', { name: 'Rocket', exact: true }).click()
      await grid.waitFor({ state: 'hidden' })

      await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
      const row = await su.query<{ icon: string | null }>('SELECT icon FROM project.project WHERE id = $1', ['halles-shop'])
      assert.equal(row.rows[0]?.icon, 'rocket', `${name}: the icon settled`)

      const rocket = await markOf(h1)
      assert.notEqual(rocket, briefcase, `${name}: the header's mark changed from the collection's to the project's own`)
      await page.screenshot({ path: `${shots}/record-icon-${name}-set.png`, fullPage: true })

      await page.goto(`${base}/projects`)
      await page.waitForLoadState('networkidle')
      const item = page.locator('.tile').filter({ has: page.getByText(title, { exact: true }) }).first()
      await item.waitFor()
      assert.equal(await markOf(item.locator('.title')), rocket, `${name}: the board's card wears the same icon as the header`)
      await page.screenshot({ path: `${shots}/record-icon-${name}-list.png`, fullPage: true })

      // Clearing it: the grid's None takes it away
      // from the header and the card, back to the collection's Briefcase.
      await page.goto(`${base}/projects/halles-shop`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Details' }).click()
      await drawer.getByRole('button', { name: /^Icon/ }).click()
      await grid.waitFor()
      await grid.getByRole('menuitemradio', { name: 'None', exact: true }).click()
      await grid.waitFor({ state: 'hidden' })
      await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
      const cleared = await su.query<{ icon: string | null }>('SELECT icon FROM project.project WHERE id = $1', ['halles-shop'])
      assert.equal(cleared.rows[0]?.icon, null, `${name}: the icon cleared`)
      assert.equal(await markOf(h1), briefcase, `${name}: the header wears the collection's icon again`)

      await page.goto(`${base}/projects`)
      await page.waitForLoadState('networkidle')
      const again = page.locator('.tile').filter({ has: page.getByText(title, { exact: true }) }).first()
      await again.waitFor()
      assert.equal(await markOf(again.locator('.title')), briefcase, `${name}: the board's card wears the collection's icon again too`)

      assert.deepEqual(errors, [], `${name}: the page threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
