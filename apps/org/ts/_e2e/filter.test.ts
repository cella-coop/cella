// A view filters on any field with a handful of values, in every
// browser: signed in as Julien on the dev server, the expenses filtered
// by their status, an enumeration, in a list, a table, a gallery, a board
// and a calendar; the files, the collection that offers a feed, by who
// uploaded them, a person, in a feed and a list; and the mandates by the
// circle that issued them, a circle, in a list and on a board. Filter
// offers each field, its chip's popover its values, a person and a circle
// by name, and each layout draws only the rows the condition keeps, as
// the scenario reads them itself. A view saved with a condition restores
// it from its tab, and the address alone draws it. Filter offers a
// field's values among the rows the other conditions keep: the mandates'
// powers, too many across them all, once Issued by keeps one circle's,
// and only the powers that circle's mandates hold. `SHOTS` names where
// its screenshots go. Nothing is written. Run by `cella test e2e filter`.
// covers: expense file

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Locator, Page } from 'playwright-core'
import { page as read, type Condition, type Source } from '@cella/org-db'
import { people } from '@cella/org-person/api'
import { limits } from '@cella/org-ui/models'
import { source } from '#lib/server/slices.ts'
import { eachBrowser, serve, signIn } from './browser.ts'

const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-filter-shots'
const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [julien])
})

after(async () => {
  await app.end()
})

type Row = Record<string, unknown> & { id: string }

const rows = async (name: string, where: Condition[] = []) => (await read(app, source(name) as Source, { where })) as Row[]

// A field's values over the rows Julien reads, the most held first.
async function held(name: string, key: string): Promise<string[]> {
  const counts = new Map<string, number>()
  for (const r of await rows(name)) {
    const v = String(r[key] ?? '')
    if (v) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([v]) => v)
}

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// The ids a layout draws, in order, in each of its groups: a board's
// columns, a calendar's days, else the rows as one.
async function drawn(page: Page, name: string, layout: string): Promise<string[][]> {
  // The collection's rows, not the View panel's.
  const rows = page.locator('div.rows:not(:has(> .label))')
  const groups: Locator = layout === 'board' ? rows.locator('section.lane') : layout === 'calendar' ? rows.locator('li.day') : rows
  return groups.evaluateAll(
    (els, prefix) =>
      els.map((el) =>
        [...el.querySelectorAll<HTMLAnchorElement>(`a[href^="${prefix}"]`)]
          .map((a) => decodeURIComponent(new URL(a.href).pathname.slice(prefix.length)))
          .filter((id, i, ids) => id && ids[i - 1] !== id),
      ),
    `/${name}/`,
  )
}

// Polls until the layout draws only rows the condition keeps, `want` in
// the collection's order: where it draws them as one, the first of them
// in that order; where it groups them, some, each one kept.
async function keeps(page: Page, name: string, layout: string, want: string[], at: string) {
  let last: string[][] = []
  for (let tries = 0; tries < 60; tries++) {
    last = await drawn(page, name, layout)
    const ids = last.flat()
    const grouped = layout === 'board' || layout === 'calendar'
    const ok = grouped ? ids.length > 0 && ids.every((id) => want.includes(id)) : JSON.stringify(last[0]) === JSON.stringify(want.slice(0, last[0]?.length || 1))
    if (ok) {
      return
    }
    await page.waitForTimeout(250)
  }
  assert.fail(`${at}: drawn ${JSON.stringify(last)}, wanted only ${JSON.stringify(want)}`)
}

eachBrowser((browserName, launch) => {
  test(`${browserName}: every layout filters on an enumeration, a person and a circle, saved in a view and in the address`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, julien)
      const page = await context.newPage()
      // Each page error with the address it was raised on.
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
      // The requests the page has in flight: a visit waits until none has
      // been for a moment, so it aborts none the page made, which Firefox
      // would raise as a page error.
      let flying = 0
      page.on('request', () => flying++)
      page.on('requestfinished', () => flying--)
      page.on('requestfailed', () => flying--)
      const settled = async () => {
        for (let quiet = 0, tries = 0; quiet < 4 && tries < 80; tries++) {
          quiet = flying > 0 ? 0 : quiet + 1
          await page.waitForTimeout(125)
        }
      }
      const visit = async (path: string) => {
        await settled()
        await page.goto(`${base}${path}`)
        await page.waitForLoadState('networkidle')
      }
      const condition = () => JSON.parse(new URL(page.url()).searchParams.get('where') ?? '[]')

      // Filter on a field in the View panel: Filter offers it, its chip's
      // popover the value, named as a person or a circle is; the address
      // takes the condition and the layout draws only what it keeps.
      const filtering = async (name: string, layout: string, field: { key: string; label: string }, value: string, said: string) => {
        const view = panel(page)
        await view.getByRole('combobox', { name: 'Filter' }).selectOption({ label: field.label })
        const item = page.locator(`[role="menuitemcheckbox"][data-value="${value}"]`)
        await item.waitFor()
        assert.equal((await item.innerText()).trim(), said, `${browserName}: ${name}'s ${field.label} offers ${value} as ${said}`)
        await item.click()
        await page.waitForURL((u) => u.searchParams.has('where'))
        assert.deepEqual(condition(), [{ field: field.key, is: [value] }])
        await page.keyboard.press('Escape')
        // The pointer rests on the panel's heading, never on a row's link
        // the popover uncovered, whose preload the next visit would abort.
        await view.getByRole('heading', { name: 'View', exact: true }).hover()
        const want = (await rows(name, [{ field: field.key, is: [value] }])).map((r) => r.id)
        assert.ok(want.length > 0 && want.length < (await rows(name)).length, `${name} by ${field.key} keeps some rows and not all`)
        await keeps(page, name, layout, want, `${browserName} ${name} ${layout} by ${field.key}`)
        assert.match(await view.locator('.chips').innerText(), new RegExp(`${field.label}: ${said}`))
      }

      // The day most expenses were spent on, which the calendar opens on,
      // and the status one of them stands in, which every layout keeps.
      const expenses = await rows('expenses')
      const busiest = (await held('expenses', 'day'))[0]
      const status = String(expenses.find((r) => r.day === busiest)?.status ?? '')
      assert.ok(busiest && status, 'Lanterne has expenses')
      assert.ok((await held('expenses', 'status')).length > 1, 'expenses stand in more than one status')
      for (const layout of ['list', 'table', 'gallery', 'board', 'calendar']) {
        await visit(`/expenses?view=${layout}${layout === 'calendar' ? `&at=${busiest}` : ''}`)
        assert.equal(await panel(page).getByRole('button', { name: layout[0].toUpperCase() + layout.slice(1), exact: true }).getAttribute('aria-pressed'), 'true', `${browserName}: expenses in a ${layout}`)
        await filtering('expenses', layout, { key: 'status', label: 'Status' }, status, status)
      }

      // A person, by name.
      const uploaders = await held('files', 'uploader')
      assert.ok(uploaders.length > 1, 'more than one person uploaded the files Julien reads')
      const names = Object.fromEntries((await people(app)).map((p) => [p.address, p.name]))
      const uploader = uploaders[0]
      for (const layout of ['feed', 'list']) {
        await visit(`/files?view=${layout}`)
        await filtering('files', layout, { key: 'uploader', label: 'By' }, uploader, names[uploader] ?? uploader)
      }

      // A circle, by name.
      const issuers = await held('mandates', 'issuer')
      assert.ok(issuers.length > 1, 'more than one circle issued the mandates')
      const issuer = issuers[0]
      const named = (await app.query<{ name: string }>('SELECT name FROM circle.circle WHERE id = $1', [issuer])).rows[0]?.name ?? issuer
      for (const layout of ['board', 'list']) {
        await visit(`/mandates?view=${layout}`)
        await filtering('mandates', layout, { key: 'issuer', label: 'Issued by' }, issuer, named)
      }

      // A view saved with its condition restores it from its tab.
      const want = (await rows('mandates', [{ field: 'issuer', is: [issuer] }])).map((r) => r.id)
      await panel(page).getByRole('button', { name: 'Save as view' }).click()
      await panel(page).getByLabel('View name').fill('Issued by one')
      await panel(page).getByRole('button', { name: 'Save view' }).click()
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await visit('/mandates?view=list')
      assert.deepEqual(condition(), [])
      await page.getByTitle(/^View Issued by one /).click()
      await page.waitForURL((u) => u.searchParams.has('where'))
      assert.deepEqual(condition(), [{ field: 'issuer', is: [issuer] }])
      await keeps(page, 'mandates', 'list', want, `${browserName}: the saved view`)

      // The address alone draws the condition, from the server.
      await visit(`/mandates?view=table&where=${encodeURIComponent(JSON.stringify([{ field: 'issuer', is: [issuer] }]))}`)
      await keeps(page, 'mandates', 'table', want, `${browserName}: the address`)
      assert.match(await panel(page).locator('.chips').innerText(), new RegExp(`Issued by: ${named}`))
      mkdirSync(shots, { recursive: true })
      await page.screenshot({ path: `${shots}/mandates-${browserName}.png` })

      // Filter offers a field's values among the rows the view's other
      // conditions keep: the mandates' powers are too many to offer
      // across them all, a handful among one circle's, and a power only
      // another circle's mandates hold is not offered.
      const powers = async (where: Condition[]) => [...new Set((await rows('mandates', where)).map((r) => String(r.power ?? '')).filter(Boolean))].sort()
      assert.ok((await powers([])).length > limits.values, `the mandates hold more than ${limits.values} powers`)
      let narrow = ''
      for (const i of issuers) {
        const n = (await powers([{ field: 'issuer', is: [i] }])).length
        if (n > 1 && n <= limits.values) {
          narrow = i
          break
        }
      }
      assert.ok(narrow, 'one circle issued a handful of the powers')
      const own = await powers([{ field: 'issuer', is: [narrow] }])
      const others = (await powers([])).filter((p) => !own.includes(p))
      assert.ok(others.length > 0, 'other circles issued powers this one did not')
      const offers = async () => (await panel(page).getByRole('combobox', { name: 'Filter' }).locator('option').allInnerTexts()).map((t) => t.trim())
      await visit('/mandates?view=list')
      assert.ok(!(await offers()).includes('Power'), `${browserName}: Filter offers no Power across every mandate`)
      await visit(`/mandates?view=list&where=${encodeURIComponent(JSON.stringify([{ field: 'issuer', is: [narrow] }]))}`)
      assert.ok((await offers()).includes('Power'), `${browserName}: Filter offers Power once Issued by keeps one circle's mandates`)
      await panel(page).getByRole('combobox', { name: 'Filter' }).selectOption({ label: 'Power' })
      const menu = page.locator('[aria-label="Condition on Power"]')
      await menu.locator('[role="menuitemcheckbox"]').first().waitFor()
      const offered = await menu.locator('[role="menuitemcheckbox"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-value') ?? ''))
      assert.deepEqual([...offered].sort(), own, `${browserName}: Power offers the powers of the mandates Issued by keeps, and only those`)
      assert.ok(!offered.some((p) => others.includes(p)), `${browserName}: no power only another circle's mandates hold is offered`)
      await page.keyboard.press('Escape')

      assert.deepEqual(errors, [], `${browserName}: no page error`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
