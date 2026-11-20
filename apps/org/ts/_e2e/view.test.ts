// The View panel has one shape on every collection, in every browser,
// display only: signed in as Camille on the dev server, each collection
// the sidebar mounts draws, under its layout, the same rows in the same
// order, Group by and Order by, then Fields, a block of its own under
// them, whatever its fields, and no
// Filter and no search box, which are the filter bar's (`filter` covers
// those, including the lens's circle as a chip, "Circle is <name>", no
// longer a row here); on a board, Columns above Grouping instead, as Linear's.
// On tasks, a board, Columns is its enumeration, migrated from the
// grouping an older view named, and Grouping opens on None, one lane,
// until it names a field of its own, each lane the whole set of columns;
// Fields lists the cards' fields. On meetings, a calendar,
// rows name its Date, Show (a month or a week) and Colour by, never Group by. Light and dark, `SHOTS` names where its
// screenshots go. Nothing is written. Run by `cella test e2e view`;
// Columns is driven by its keyboard too.
// covers: all

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'
import { chosen } from './controls.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-view-shots'
const rows = ['Group by', 'Order by', 'Fields']
const boardRows = ['Columns', 'Grouping', 'Order by', 'Fields']
const calendarRows = ['Date', 'Show', 'Colour by', 'Order by', 'Fields']

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// A combobox's `aria-expanded`, a tick behind the popover's own open or
// closed state (its `toggle` event, which moves it, is a task queued
// after the popover shows or hides): wait for it rather than race it.
async function expanded(page: Page, by: { getAttribute: (n: string) => Promise<string | null> }, want: 'true' | 'false') {
  let got: string | null = null
  for (let tries = 0; tries < 40 && got !== want; tries++) {
    got = await by.getAttribute('aria-expanded')
    if (got !== want) {
      await page.waitForTimeout(25)
    }
  }
  return got
}

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
            const boardBtn = view.getByRole('button', { name: 'Board', exact: true })
            const board = (await boardBtn.count()) > 0 && (await boardBtn.getAttribute('aria-pressed')) === 'true'
            const calendarBtn = view.getByRole('button', { name: 'Calendar', exact: true })
            const calendar = (await calendarBtn.count()) > 0 && (await calendarBtn.getAttribute('aria-pressed')) === 'true'
            const want = board ? boardRows : calendar ? calendarRows : rows
            assert.deepEqual(await view.locator('.rows > .label, .fields > .label').allTextContents(), want, `${at}: ${path}'s View panel has the one shape`)
            assert.equal(await view.getByRole('group', { name: 'Layout' }).count(), 1, `${at}: ${path}'s layout is on top`)
          }
          assert.ok(seen > 10, `${at}: the panel is checked on most collections, ${seen}`)
        }

        await visit('/tasks')
        const view = panel(page)
        // Columns, above Grouping: tasks open as a board by status in a
        // swimlane for each project (project-task's look, 20 Nov).
        assert.equal(await chosen(view.getByLabel('Columns')), 'status', `${at}: a board's columns are its enumeration`)
        assert.equal(await chosen(view.getByLabel('Grouping')), 'project', `${at}: tasks open in a swimlane for each project`)
        await page.screenshot({ path: `${shots}/tasks-${name}-${scheme}.png` })
        // Order by names a field alone, never "Default", its direction
        // before it, so every control ends on the panel's one right edge;
        // pinning, renaming and deleting are a view chip's menu, never the
        // panel's (`menu`). Filtering and Save are the filter bar's.
        assert.doesNotMatch((await view.textContent()) ?? '', /Default/, `${at}: the panel never says Default`)
        const edge = async (control: string) => {
          const box = await view.getByRole('combobox', { name: control }).boundingBox()
          return box ? box.x + box.width : NaN
        }
        const direction = await view.locator('.order .direction').boundingBox()
        const ordering = await view.getByRole('combobox', { name: 'Order by' }).boundingBox()
        assert.ok(direction && ordering && direction.x + direction.width <= ordering.x + 1, `${at}: the direction sits before Order by`)
        assert.ok(direction && ordering && Math.abs(direction.y - ordering.y) < 8, `${at}: the direction and Order by share a row`)
        for (const control of ['Grouping', 'Order by']) {
          assert.ok(Math.abs((await edge(control)) - (await edge('Columns'))) < 1.5, `${at}: ${control} ends on Columns's right edge`)
        }
        assert.equal(await view.getByRole('button', { name: 'Save', exact: true }).count(), 0, `${at}: no Save in the View panel, which the filter bar carries instead`)
        assert.equal(await view.getByRole('button', { name: /pin|delete/i }).count(), 0, `${at}: no Pin and no Delete in the View panel, which a view's chip menu carries instead`)
        assert.equal(await view.getByRole('textbox', { name: 'View name' }).count(), 0, `${at}: no name to edit in the View panel, which a chip renames in place`)
        assert.equal(await view.getByRole('button', { name: 'Filter', exact: true }).count(), 0, `${at}: the View panel offers no Filter`)
        assert.equal(await view.getByPlaceholder('Search').count(), 0, `${at}: the View panel has no search box`)
        // Columns answers the keyboard: an arrow opens its list, past six
        // lanes a search box over it, which takes the focus, else the
        // option chosen does; either way that option wears its check.
        // Escape closes it, choosing nothing, the focus staying on it.
        const by = view.getByRole('combobox', { name: 'Columns' })
        const list = page.locator(`[id="${await by.getAttribute('aria-controls')}"]`)
        await by.focus()
        await page.keyboard.press('ArrowDown')
        await list.waitFor()
        assert.equal(await expanded(page, by, 'true'), 'true', `${at}: an arrow opens Columns`)
        const search = list.locator('input.search')
        if (await search.count()) {
          assert.ok(await search.evaluate((el) => el === document.activeElement), `${at}: with a search box, it takes the focus`)
        } else {
          const active = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.value ?? null)
          assert.equal(await active(), 'status', `${at}: on the option chosen`)
        }
        assert.equal(await list.locator('[role=option][aria-selected=true]').filter({ has: page.locator('svg') }).count(), 1, `${at}: the chosen option wears its check`)

        await page.screenshot({ path: `${shots}/tasks-group-by-${name}-${scheme}.png` })
        await page.keyboard.press('Escape')
        await list.waitFor({ state: 'hidden' })
        assert.equal(await expanded(page, by, 'false'), 'false', `${at}: Escape closes it`)
        assert.ok(await by.evaluate((el) => el === document.activeElement), `${at}: the focus stays on Group by`)
        assert.equal(await chosen(by), 'status', `${at}: Escape chooses nothing`)

        assert.ok((await view.getByRole('button', { name: /^Hide / }).count()) > 0, `${at}: Fields shows the cards' fields as chips`)
        await view.getByRole('button', { name: 'Add', exact: true }).click()
        const display = page.getByRole('dialog', { name: 'Add a field' })
        await display.waitFor()
        assert.ok((await display.getByRole('checkbox').count()) > 0, `${at}: its + lists the fields the cards leave out`)
        await page.screenshot({ path: `${shots}/tasks-display-${name}-${scheme}.png` })
        await page.keyboard.press('Escape')

        await visit('/meetings')
        assert.ok(await panel(page).getByLabel('Show').isVisible(), `${at}: a calendar names its date, its span and its colour`)
        assert.equal(await panel(page).getByText('Group by').count(), 0, `${at}: a calendar groups nothing`)
        await page.screenshot({ path: `${shots}/meetings-${name}-${scheme}.png` })

        await visit('/timesheets')
        await panel(page).getByRole('button', { name: 'Add', exact: true }).click()
        await page.getByRole('dialog', { name: 'Add a field' }).waitFor()
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

eachBrowser((name, launch) => {
  test(`${name}: a view saved as a dashboard opens in its collection's own layout, its widgets dropped`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, 'camille@lanterne.example')
      // A store from before the dashboard was retired: one timesheets
      // view laid out as a dashboard, with its widgets.
      const old = {
        v: 1,
        views: { timesheets: [{ id: 'c-old', name: 'Old dashboard', icon: 'bookmark', spec: { layout: 'dashboard', widgets: [{ kind: 'kpi', title: 'Hours', measure: { op: 'sum', field: 'hours' } }] } }] },
        pins: [],
      }
      await context.addInitScript((store) => {
        if (!localStorage.getItem('cella-views')) {
          localStorage.setItem('cella-views', store)
        }
      }, JSON.stringify(old))
      const page = await context.newPage()
      await page.goto(`${base}/timesheets`)
      await page.waitForLoadState('networkidle')
      const tab = page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: 'Old dashboard' })
      const href = (await tab.getAttribute('href')) ?? ''
      assert.ok(!href.includes('view='), `the saved view's address names no layout of its own, the timesheets' table: ${href}`)
      assert.ok(!href.includes('w='), 'nor any widgets')
      await tab.click()
      await page.waitForURL(/v=c-old/)
      await page.locator('.rows .table, .rows table').first().waitFor()
      assert.equal(await page.locator('.dashboard').count(), 0, 'no dashboard is drawn')
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
