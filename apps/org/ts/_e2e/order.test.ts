// A view orders its rows by any field, either way, in every browser:
// signed in as Julien on the dev server, the expenses ordered by their
// amount and by the day they were spent, each way, in a list, a table, a
// gallery, a board and a calendar, and the files, the collection that
// offers a feed, by the day they were uploaded and by their size, shown
// as text; each layout draws its rows in the order the scenario works out
// from the rows themselves, a number by its amount, a board's in each
// column and a calendar's on each day. Order by and its direction put the
// sort in the address, a table's header sets it and says it by
// `aria-sort`, a view saved with it restores it, and the address alone
// draws it. `SHOTS` names where its screenshots go. Nothing is
// written. Run by `cella test e2e order`.

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Locator, Page } from 'playwright-core'
import { page as read, type Sort, type Source } from '@cella/org-db'
import { source } from '#lib/server/slices.ts'
import { browsers, serve, signIn } from './browser.ts'

const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-order-shots'
const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [julien])
})

after(async () => {
  await app.end()
})

type Row = Record<string, unknown> & { id: string }

// The rows in the collection's own order, then sorted here as the view
// asks: a number by its amount, a date by its text, a row with none last
// either way, ties in the collection's order.
async function expected(name: string, sort: Sort): Promise<string[]> {
  const rows = (await read(app, source(name) as Source, { where: [] })) as Row[]
  const none = (v: unknown) => v === null || v === undefined || v === ''
  const by = (a: Row, b: Row) => {
    const [x, y] = [a[sort.field], b[sort.field]]
    if (none(x) || none(y)) {
      return Number(none(x)) - Number(none(y))
    }
    const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0
    return sort.dir === 'desc' ? -order : order
  }
  return rows.toSorted(by).map((r) => r.id)
}

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// The ids a layout draws, in order, in each of its groups: a board's
// columns, a calendar's days, a feed's lines, else the rows as one.
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

// Polls until the layout draws its rows as `want` orders them: all of
// them in order where it draws them as one, and each group's in their
// relative order where it groups them, some group holding more than
// one, so its order is seen.
async function follows(page: Page, name: string, layout: string, want: string[], at: string) {
  let last: string[][] = []
  for (let tries = 0; tries < 60; tries++) {
    last = await drawn(page, name, layout)
    const grouped = layout === 'board' || layout === 'calendar'
    const ok = grouped
      ? last.every((ids) => ids.every((id, i) => i === 0 || want.indexOf(ids[i - 1]) < want.indexOf(id))) && last.some((ids) => ids.length > 1)
      : JSON.stringify(last[0]) === JSON.stringify(want.slice(0, last[0]?.length || 1))
    if (ok) {
      return
    }
    await page.waitForTimeout(250)
  }
  assert.fail(`${at}: drawn ${JSON.stringify(last)}, wanted in the order ${JSON.stringify(want)}`)
}

for (const [browserName, launch] of browsers()) {
  test(`${browserName}: every layout orders its rows by a money, a number and a date field either way, saved in a view and in the address`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, julien)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const visit = async (path: string) => {
        await page.goto(`${base}${path}`)
        await page.waitForLoadState('networkidle')
      }
      const sort = () => new URL(page.url()).searchParams.get('sort')
      const sorted = async (want: string) => {
        await page.waitForURL((u) => u.searchParams.get('sort') === want)
        assert.equal(sort(), want)
      }

      // Order by a field and turn its direction, in the View panel; each
      // order checked against the rows sorted here.
      const ordering = async (name: string, layout: string, fields: string[]) => {
        const view = panel(page)
        const select = view.getByLabel('Order by')
        for (const field of fields) {
          const dir = sort()?.startsWith('-') ? 'desc' : 'asc'
          await select.selectOption(field)
          await sorted(`${dir === 'desc' ? '-' : ''}${field}`)
          await follows(page, name, layout, await expected(name, { field, dir }), `${browserName} ${name} ${layout} by ${field}, ${dir}`)
          await view.getByRole('button', { name: dir === 'desc' ? 'Descending' : 'Ascending' }).click()
          const turned = dir === 'desc' ? 'asc' : 'desc'
          await sorted(`${turned === 'desc' ? '-' : ''}${field}`)
          await follows(page, name, layout, await expected(name, { field, dir: turned }), `${browserName} ${name} ${layout} by ${field}, ${turned}`)
        }
      }

      // The day most expenses were spent on, which the calendar opens on.
      const days = new Map<string, number>()
      for (const r of (await read(app, source('expenses') as Source, { where: [] })) as Row[]) {
        days.set(String(r.day), (days.get(String(r.day)) ?? 0) + 1)
      }
      const busiest = [...days].sort((a, b) => b[1] - a[1])[0]?.[0]
      assert.ok(busiest, 'Lanterne has expenses')

      for (const layout of ['list', 'table', 'gallery', 'board', 'calendar']) {
        await visit(`/expenses?view=${layout}${layout === 'calendar' ? `&at=${busiest}` : ''}`)
        assert.equal(await panel(page).getByRole('button', { name: layout[0].toUpperCase() + layout.slice(1), exact: true }).getAttribute('aria-pressed'), 'true', `${browserName}: expenses in a ${layout}`)
        await ordering('expenses', layout, ['total', 'day'])
      }

      await visit('/files?view=feed')
      assert.equal(await panel(page).getByRole('button', { name: 'Feed', exact: true }).getAttribute('aria-pressed'), 'true', `${browserName}: files in a feed`)
      await ordering('files', 'feed', ['uploaded', 'size'])

      // A table's header orders by its column, and again turns it; the
      // header says so.
      await visit('/expenses?view=table')
      const amount = page.locator('th', { hasText: 'Amount' })
      await amount.getByRole('button').click()
      await sorted('total')
      await follows(page, 'expenses', 'table', await expected('expenses', { field: 'total', dir: 'asc' }), `${browserName}: the Amount header`)
      assert.equal(await amount.getAttribute('aria-sort'), 'ascending')
      await amount.getByRole('button').click()
      await sorted('-total')
      await follows(page, 'expenses', 'table', await expected('expenses', { field: 'total', dir: 'desc' }), `${browserName}: the Amount header again`)
      assert.equal(await amount.getAttribute('aria-sort'), 'descending')

      // A view saved with its order restores it from its tab.
      await panel(page).getByRole('button', { name: 'Save as view' }).click()
      await panel(page).getByLabel('View name').fill('Largest first')
      await panel(page).getByRole('button', { name: 'Save view' }).click()
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await visit('/expenses?view=table')
      assert.equal(sort(), null)
      await page.getByTitle(/^View Largest first /).click()
      await sorted('-total')
      await follows(page, 'expenses', 'table', await expected('expenses', { field: 'total', dir: 'desc' }), `${browserName}: the saved view`)
      assert.equal(await panel(page).getByLabel('Order by').inputValue(), 'total', `${browserName}: Order by names the saved view's field`)

      // The address alone draws the order, from the server.
      await visit('/expenses?view=table&sort=-day')
      await follows(page, 'expenses', 'table', await expected('expenses', { field: 'day', dir: 'desc' }), `${browserName}: the address`)
      assert.equal(await panel(page).getByRole('button', { name: 'Descending' }).count(), 1, `${browserName}: the direction says descending`)
      mkdirSync(shots, { recursive: true })
      await page.screenshot({ path: `${shots}/expenses-${browserName}.png` })

      assert.deepEqual(errors, [], `${browserName}: no page error`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
}
