// A narrow window keeps the frame's header one row: in every browser,
// light and dark, signed in as Camille on the dev server, at 760, 900 and
// 1100px wide, where the sidebar, the content at its least width and the
// drawer cannot sit side by side, a collection with its View panel open
// and an item with its Details open each draw the header as one row, and
// the drawer lies over the content's right edge rather than under it;
// Escape shuts it. At 1440px the drawer sits beside the content. A
// person's chip wears the people's icon, one person, and the sidebar's
// People and Circles wear their own, one person and a group. `SHOTS` names
// where its screenshots go. Nothing is written. Run by
// `cella test e2e narrow`.
// covers: core task

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-narrow-shots'

type Box = { x: number; y: number; width: number; height: number }
const box = async (page: Page, selector: string): Promise<Box> => {
  const b = await page.locator(selector).first().boundingBox()
  assert.ok(b, `${selector} is drawn`)
  return b
}

// The path of an icon's drawing, as its svg holds it.
const drawn = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((svg) => [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d')).join(' '))

eachBrowser((name, launch) => {
  test(`${name}: at 760, 900 and 1100px the drawer lies over the content and the header stays one row, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        const visit = async (path: string) => {
          await context.addCookies([{ name: 'cella-drawer', value: 'open', url: base }])
          await page.goto(`${base}${path}`)
          await page.waitForLoadState('networkidle')
        }

        for (const [what, path, panel] of [
          ['tasks', '/tasks', 'View'],
          ['motion', '/motions/m-2026-012', 'Details'],
        ] as const) {
          await page.setViewportSize({ width: 1440, height: 900 })
          await visit(path)
          const wide = await box(page, '.frame > .top')
          const beside = await box(page, '.frame > .drawer')
          const content = await box(page, '.frame > .content')
          assert.ok(beside.x >= content.x + content.width - 1, `${name}, ${scheme}, ${what} at 1440px: the drawer sits beside the content`)

          for (const width of [760, 900, 1100]) {
            const at = `${name}, ${scheme}, ${what} at ${width}px`
            await page.setViewportSize({ width, height: 900 })
            await visit(path)
            assert.equal(await page.getByRole('complementary', { name: panel }).count(), 1, `${at}: the ${panel} panel is open`)
            const top = await box(page, '.frame > .top')
            const drawer = await box(page, '.frame > .drawer')
            const under = await box(page, '.frame > .content')
            assert.ok(top.height <= wide.height + 1, `${at}: the header is one row, ${top.height}px as at 1440px ${wide.height}px`)
            assert.ok(Math.abs(drawer.y - under.y) <= 1, `${at}: the drawer starts where the content does, not under it`)
            assert.ok(drawer.x < under.x + under.width && drawer.x + drawer.width <= under.x + under.width + 1, `${at}: the drawer lies over the content's right edge`)
            await page.screenshot({ path: `${shots}/${what}-${width}-${name}-${scheme}.png` })
            await page.locator('.frame > .content').click({ position: { x: 4, y: 4 } })
            await page.keyboard.press('Escape')
            await page.locator('.frame > .drawer').waitFor({ state: 'detached' })
            assert.equal(page.url(), `${base}${path}`, `${at}: Escape shuts the drawer and stays on the page`)
          }
        }

        await page.setViewportSize({ width: 1440, height: 900 })
        await visit('/tasks')
        const nav = page.getByRole('navigation', { name: 'Main' })
        const people = nav.locator('a[href="/people"] svg')
        const circles = nav.locator('a[href="/circles"] svg')
        if ((await people.count()) && (await circles.count())) {
          assert.notEqual(await drawn(page, 'nav a[href="/people"] svg'), await drawn(page, 'nav a[href="/circles"] svg'), `${name}, ${scheme}: People and Circles wear their own icons`)
        }
        const chip = page.locator('.record:has(.person) .mark svg')
        if (await chip.count()) {
          const person = await drawn(page, '.record:has(.person) .mark svg')
          if (await people.count()) {
            assert.equal(person, await drawn(page, 'nav a[href="/people"] svg'), `${name}, ${scheme}: a person's chip wears the people's icon`)
          }
        }
        await page.screenshot({ path: `${shots}/chips-${name}-${scheme}.png` })
        assert.deepEqual(errors, [], `${name}, ${scheme}: no page error`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
