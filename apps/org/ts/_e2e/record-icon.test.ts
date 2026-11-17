// The record icon scenario, in Chromium, on a seeded Lanterne through the
// dev server: Yusuf, Web's lead, opens the Shop's project page, picks an
// icon from the curated grid in the Details drawer's Icon section, and
// its header and its row in the Projects list both wear it, in the
// project's own ink; clearing it, with the grid's None, takes it away
// from both, back to the collection's. `SHOTS` names where its
// screenshots go. Run by `cella test e2e record-icon`.
// covers: project

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-record-icon-shots'
const yusuf = 'yusuf@lanterne.example'
const title = 'Les Halles Paysannes, online shop'

eachBrowser((name, launch) => {
  test(`${name}: Yusuf picks a project's own icon, sees it in its header and its row, and clears it`, async () => {
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
      assert.equal(await h1.locator('.mark').count(), 0, `${name}: no icon set yet, so the header wears none`)

      await page.getByRole('tab', { name: 'Details' }).click()
      const drawer = page.getByRole('complementary', { name: 'Details' })
      const section = drawer.locator('section', { has: page.getByRole('heading', { name: 'Icon', exact: true }) })
      const trigger = section.getByRole('button', { name: 'Icon' })
      await trigger.waitFor()

      await trigger.click()
      const grid = page.getByRole('menu', { name: 'Icon' })
      await grid.waitFor()
      await grid.getByRole('textbox', { name: 'Search icons' }).fill('Rocket')
      await grid.getByRole('menuitemradio', { name: 'Rocket', exact: true }).click()
      await grid.waitFor({ state: 'hidden' })

      await section.getByRole('button', { name: 'Set icon' }).click()
      await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
      const row = await su.query<{ icon: string | null }>('SELECT icon FROM project.project WHERE id = $1', ['halles-shop'])
      assert.equal(row.rows[0]?.icon, 'rocket', `${name}: the icon settled`)

      assert.equal(await h1.locator('.mark').count(), 1, `${name}: the header now wears the project's own icon`)
      await page.screenshot({ path: `${shots}/record-icon-${name}-set.png`, fullPage: true })

      await page.goto(`${base}/projects`)
      await page.waitForLoadState('networkidle')
      const item = page.locator('li').filter({ has: page.getByText(title, { exact: true }) }).first()
      await item.waitFor()
      assert.equal(await item.locator('.title .mark').count(), 1, `${name}: the list cell wears the project's own icon too`)
      await page.screenshot({ path: `${shots}/record-icon-${name}-list.png`, fullPage: true })

      // Clearing it: the grid's None, then the same submit, takes it away
      // from the header and the row, back to the collection's icon.
      await page.goto(`${base}/projects/halles-shop`)
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Details' }).click()
      await trigger.click()
      await grid.waitFor()
      await grid.getByRole('menuitemradio', { name: 'None', exact: true }).click()
      await grid.waitFor({ state: 'hidden' })
      await section.getByRole('button', { name: 'Change icon' }).click()
      await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
      const cleared = await su.query<{ icon: string | null }>('SELECT icon FROM project.project WHERE id = $1', ['halles-shop'])
      assert.equal(cleared.rows[0]?.icon, null, `${name}: the icon cleared`)
      assert.equal(await h1.locator('.mark').count(), 0, `${name}: the header wears the collection's icon again`)

      await page.goto(`${base}/projects`)
      await page.waitForLoadState('networkidle')
      const again = page.locator('li').filter({ has: page.getByText(title, { exact: true }) }).first()
      await again.waitFor()
      assert.equal(await again.locator('.title .mark').count(), 0, `${name}: the list cell wears none of its own again`)

      assert.deepEqual(errors, [], `${name}: the page threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
