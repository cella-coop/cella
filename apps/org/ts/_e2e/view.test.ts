// The View panel has one shape on every collection, in every browser:
// signed in as Camille on the dev server, each collection the sidebar
// mounts draws, under its layout and its text filter, the same rows in
// the same order, Group by, Order by, Filter, Display and Circles,
// whatever its fields. On tasks, a board, Group by is its enumeration; a
// field chosen in Filter opens its chip's popover, a value picked there
// keeps the rows in the address and names itself on the chip, and Remove
// takes the condition away; Display opens a popover of the cards' fields. On
// meetings, a calendar, Group by is its date and span. Light and dark,
// `SHOTS` names where its screenshots go. Nothing is written. Run by
// `cella test e2e view`.
// covers: all

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-view-shots'
const rows = ['Group by', 'Order by', 'Filter', 'Display', 'Circles']

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

eachBrowser((name, launch) => {
  test(`${name}: every collection's View panel has one shape, its specifics in its dropdowns and popovers, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        const visit = async (path: string) => {
          await page.goto(`${base}${path}`)
          await page.waitForLoadState('networkidle')
        }
        const at = `${name}, ${scheme}`

        if (scheme === 'light') {
          // The sidebar shows the features of the circle she is in: gather
          // the assembly's, Operations' and Web's, every accordion open.
          const nav = page.getByRole('navigation', { name: 'Main' })
          const shut = nav.locator('button.head[aria-expanded="false"]')
          const hrefs: string[] = []
          for (const lens of ['operations', 'web', '']) {
            await context.addCookies([{ name: 'cella-lens', value: lens, url: base }])
            await visit('/')
            for (let left = 20; left > 0 && (await shut.count()) > 0; left--) {
              await shut.first().click()
            }
            hrefs.push(...(await nav.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))))
          }
          let seen = 0
          for (const path of [...new Set(hrefs)].filter((h) => h !== '/')) {
            await visit(path)
            const view = panel(page)
            if (!(await view.count())) {
              continue
            }
            seen++
            assert.deepEqual(await view.locator('.rows > .label').allTextContents(), rows, `${at}: ${path}'s View panel has the one shape`)
            assert.equal(await view.getByRole('group', { name: 'Layout' }).count(), 1, `${at}: ${path}'s layout is on top`)
          }
          assert.ok(seen > 10, `${at}: the panel is checked on most collections, ${seen}`)
        }

        await visit('/tasks')
        const view = panel(page)
        assert.equal(await view.getByLabel('Group by').inputValue(), 'status', `${at}: a board groups by its enumeration`)
        await page.screenshot({ path: `${shots}/tasks-${name}-${scheme}.png` })
        const filter = view.getByLabel('Filter', { exact: true }).last()
        const field = await filter.locator('option').nth(1).getAttribute('value')
        assert.ok(field, `${at}: Filter offers a field`)
        await filter.selectOption(field)
        const menu = page.getByRole('menu', { name: /^Condition on / })
        await menu.waitFor()
        const value = (await menu.getByRole('menuitemcheckbox').first().textContent())!.trim()
        await page.screenshot({ path: `${shots}/tasks-condition-${name}-${scheme}.png` })
        await menu.getByRole('menuitemcheckbox').first().click()
        await page.waitForURL(/[?&]where=/)
        // The rows follow the address once its query answers.
        await view.locator('.chips', { hasText: `: ${value}` }).waitFor()
        assert.match((await view.locator('.chips').textContent()) ?? '', new RegExp(`: ${value}`), `${at}: the chip names what it keeps`)
        await menu.getByRole('menuitem', { name: 'Remove' }).click()
        await page.waitForURL((u) => !u.searchParams.has('where'))
        await view.locator('.chips').waitFor({ state: 'detached' })
        assert.equal(await view.locator('.chips').count(), 0, `${at}: Remove takes the condition away`)

        await view.getByRole('button', { name: /card fields$/ }).click()
        const display = page.getByRole('dialog', { name: 'Display' })
        await display.waitFor()
        assert.ok((await display.getByRole('checkbox').count()) > 0, `${at}: Display lists the cards' fields`)
        await page.screenshot({ path: `${shots}/tasks-display-${name}-${scheme}.png` })
        await page.keyboard.press('Escape')

        await visit('/meetings')
        assert.ok(await panel(page).getByLabel('Span').isVisible(), `${at}: a calendar groups by its date and span`)
        await page.screenshot({ path: `${shots}/meetings-${name}-${scheme}.png` })

        await visit('/timesheets')
        await panel(page).getByRole('button', { name: /columns$/ }).click()
        await page.getByRole('dialog', { name: 'Display' }).waitFor()
        await page.screenshot({ path: `${shots}/timesheets-display-${name}-${scheme}.png` })

        assert.deepEqual(errors, [], `${at}: no page error`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
