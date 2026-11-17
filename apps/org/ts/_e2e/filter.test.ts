// A view filters on any field with a handful of values, through the
// filter bar's + Filter, in every browser: signed in as Julien on the
// dev server, the expenses filtered by their status, an enumeration, in
// a list, a table, a gallery, a board and a calendar; the files, by who
// uploaded them, a person, in a list; and the mandates by the
// circle that issued them, a circle, in a list and on a board. + Filter
// offers each field, its chip's popover its values, a person and a circle
// by name, and each layout draws only the rows the condition keeps, as
// the scenario reads them itself; the chip it adds carries a dot, unsaved.
// A view saved with a condition restores it from its tab, and the
// address alone draws it. + Filter offers a field's values among the
// rows the other conditions keep: the mandates' powers, too many across
// them all, once Issued by keeps one circle's, and only the powers that
// circle's mandates hold. A second scenario covers the bar itself: a
// chip's x removes it, a click reopens it; Search expands, filters live
// and commits as a chip; "/" and "F" open them; a filter in the address
// survives a reload; Save and Reset act on a changed view; the View
// panel carries no Filter. `SHOTS` names where its screenshots go.
// Nothing is written. Run by `cella test e2e filter`.
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
import { choose, offered as listed } from './controls.ts'

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

      // Filter on a field through the filter bar's + Filter: it offers
      // the field, its chip's popover the value, named as a person or a
      // circle is; the address takes the condition and the layout draws
      // only what it keeps, the chip carrying a dot, unsaved.
      const filtering = async (name: string, layout: string, field: { key: string; label: string }, value: string, said: string) => {
        await choose(page.getByRole('combobox', { name: 'Filter' }), { label: field.label })
        const item = page.locator(`[role="menuitemcheckbox"][data-value="${value}"]`)
        await item.waitFor()
        assert.equal((await item.innerText()).trim(), said, `${browserName}: ${name}'s ${field.label} offers ${value} as ${said}`)
        await item.click()
        await page.waitForURL((u) => u.searchParams.has('where'))
        assert.deepEqual(condition(), [{ field: field.key, is: [value] }])
        await page.keyboard.press('Escape')
        // The pointer rests on the page's title, never on a row's link
        // the popover uncovered, whose preload the next visit would abort.
        await page.locator('h1').first().hover()
        const want = (await rows(name, [{ field: field.key, is: [value] }])).map((r) => r.id)
        assert.ok(want.length > 0 && want.length < (await rows(name)).length, `${name} by ${field.key} keeps some rows and not all`)
        await keeps(page, name, layout, want, `${browserName} ${name} ${layout} by ${field.key}`)
        const chip = page.locator('.bar .chip', { hasText: `${field.label}: ${said}` })
        await chip.waitFor()
        assert.equal(await chip.locator('.dot').count(), 1, `${browserName}: ${name}'s unsaved ${field.label} chip carries a dot`)
      }

      // The day most expenses were spent on, which the calendar opens on,
      // and the status one of them stands in, which every layout keeps.
      const expenses = await rows('expenses')
      const busiest = (await held('expenses', 'day'))[0]
      const status = String(expenses.find((r) => r.day === busiest)?.status ?? '')
      assert.ok(busiest && status, 'Lanterne has expenses')
      assert.ok((await held('expenses', 'status')).length > 1, 'expenses stand in more than one status')
      for (const layout of ['list', 'table', 'gallery', 'board', 'calendar']) {
        // Grouped by nothing and in the collection's own order, which the
        // rows kept are worked out in.
        await visit(`/expenses?view=${layout}&by=&sort=${layout === 'calendar' ? `&at=${busiest}` : ''}`)
        assert.equal(await panel(page).getByRole('button', { name: layout[0].toUpperCase() + layout.slice(1), exact: true }).getAttribute('aria-pressed'), 'true', `${browserName}: expenses in a ${layout}`)
        await filtering('expenses', layout, { key: 'status', label: 'Status' }, status, status)
      }

      // A person, by name.
      const uploaders = await held('files', 'uploader')
      assert.ok(uploaders.length > 1, 'more than one person uploaded the files Julien reads')
      const names = Object.fromEntries((await people(app)).map((p) => [p.address, p.name]))
      const uploader = uploaders[0]
      for (const layout of ['list']) {
        await visit(`/files?view=${layout}&by=&sort=`)
        await filtering('files', layout, { key: 'uploader', label: 'By' }, uploader, names[uploader] ?? uploader)
      }

      // A circle, by name.
      const issuers = await held('mandates', 'issuer')
      assert.ok(issuers.length > 1, 'more than one circle issued the mandates')
      const issuer = issuers[0]
      const named = (await app.query<{ name: string }>('SELECT name FROM circle.circle WHERE id = $1', [issuer])).rows[0]?.name ?? issuer
      for (const layout of ['board', 'list']) {
        await visit(`/mandates?view=${layout}&by=&sort=`)
        await filtering('mandates', layout, { key: 'issuer', label: 'Issued by' }, issuer, named)
      }

      // A view saved with its condition restores it from its tab: the
      // filter bar's Save, through the View panel's own naming form.
      const want = (await rows('mandates', [{ field: 'issuer', is: [issuer] }])).map((r) => r.id)
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await panel(page).getByLabel('View name').fill('Issued by one')
      await panel(page).getByRole('button', { name: 'Save view' }).click()
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await visit('/mandates?view=list&by=&sort=')
      assert.deepEqual(condition(), [])
      await page.getByTitle(/^View Issued by one /).click()
      await page.waitForURL((u) => u.searchParams.has('where'))
      assert.deepEqual(condition(), [{ field: 'issuer', is: [issuer] }])
      await keeps(page, 'mandates', 'list', want, `${browserName}: the saved view`)

      // The address alone draws the condition, from the server.
      await visit(`/mandates?view=table&by=&sort=&where=${encodeURIComponent(JSON.stringify([{ field: 'issuer', is: [issuer] }]))}`)
      await keeps(page, 'mandates', 'table', want, `${browserName}: the address`)
      assert.match(await page.locator('.bar').innerText(), new RegExp(`Issued by: ${named}`))
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
      const offers = async () => (await listed(page.getByRole('combobox', { name: 'Filter' }))).map((o) => o.label)
      await visit('/mandates?view=list')
      assert.ok(!(await offers()).includes('Power'), `${browserName}: + Filter offers no Power across every mandate`)
      await visit(`/mandates?view=list&where=${encodeURIComponent(JSON.stringify([{ field: 'issuer', is: [narrow] }]))}`)
      assert.ok((await offers()).includes('Power'), `${browserName}: + Filter offers Power once Issued by keeps one circle's mandates`)
      await choose(page.getByRole('combobox', { name: 'Filter' }), { label: 'Power' })

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

eachBrowser((browserName, launch) => {
  test(`${browserName}: the filter bar's chips, its Search and + Filter, "/" and "F", a reload, and Save and Reset`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, julien)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))

      const expenses = await rows('expenses')
      const [a, b] = await held('expenses', 'status')
      assert.ok(a && b && a !== b, 'expenses stand in at least two statuses')

      // Expenses' own look is a board; bare, it draws its own default
      // form, nothing changed from it.
      await page.goto(`${base}/expenses`)
      await page.waitForLoadState('networkidle')

      // Nothing is filtered, the view its own default form: no bar above
      // the rows, and the View panel itself offers no Filter and no
      // search box, which are the bar's alone.
      assert.equal(await page.locator('.content > div.bar').count(), 0, `${browserName}: no bar above the rows while nothing is filtered`)
      assert.equal(await panel(page).getByRole('combobox', { name: 'Filter' }).count(), 0, `${browserName}: the View panel offers no Filter`)
      assert.equal(await panel(page).getByPlaceholder('Search').count(), 0, `${browserName}: the View panel has no search box`)
      await page.getByRole('button', { name: 'Search' }).waitFor()
      await page.getByRole('combobox', { name: 'Filter' }).waitFor()

      // "/" opens Search, focused, drawing the bar at once; an empty blur
      // folds it back into the header.
      await page.keyboard.press('/')
      const search = page.getByRole('textbox', { name: 'Search' })
      await search.waitFor()
      assert.ok(await search.evaluate((el) => el === document.activeElement), `${browserName}: / focuses Search`)
      assert.equal(await page.locator('.content > div.bar').count(), 1, `${browserName}: the bar draws above the rows once Search is open`)
      await search.blur()
      assert.equal(await page.locator('.content > div.bar').count(), 0, `${browserName}: an empty Search folds back into the header on blur`)

      // Grouped by nothing and in the collection's own order, for a
      // deterministic check that typing filters live.
      await page.goto(`${base}/expenses?view=list&by=&sort=`)
      await page.waitForLoadState('networkidle')
      await page.keyboard.press('/')
      await search.waitFor()
      await search.fill(a)
      await page.waitForURL((u) => u.searchParams.get('q') === a)
      const wantA = (await rows('expenses', [{ field: 'status', is: [a] }])).map((r) => r.id)
      assert.ok(wantA.length > 0 && wantA.length < expenses.length, 'status a keeps some expenses and not all')
      await keeps(page, 'expenses', 'list', wantA, `${browserName}: Search filters live`)

      // A blur commits it as a chip, which a click reopens, its text kept.
      await search.blur()
      const searchChip = page.locator('.bar .chip', { hasText: `Search: "${a}"` })
      await searchChip.waitFor()
      assert.equal(await page.getByRole('textbox', { name: 'Search' }).count(), 0, `${browserName}: the input folds to its chip on blur`)
      await searchChip.getByRole('button', { name: new RegExp(`^Search: "${a}"`) }).click()
      await search.waitFor()
      assert.equal(await search.inputValue(), a, `${browserName}: reopening the chip keeps what was typed`)

      // Its own × removes it at once, without the typing's debounce.
      await search.blur()
      await searchChip.waitFor()
      await searchChip.getByRole('button', { name: 'Remove the search' }).click()
      await page.waitForURL((u) => !u.searchParams.has('q'))
      await searchChip.waitFor({ state: 'detached' })
      assert.equal(await page.locator('.bar .chip', { hasText: 'Search:' }).count(), 0, `${browserName}: × removes the search at once`)

      // "F" opens + Filter's list of fields, as a click on it would.
      await page.keyboard.press('f')
      const addFilter = page.getByRole('combobox', { name: 'Filter' })
      await addFilter.waitFor()
      const addList = page.locator(`[id="${await addFilter.getAttribute('aria-controls')}"]`)
      const statusOption = addList.locator('[role="option"][data-value="status"]')
      await statusOption.waitFor()
      assert.equal(await addFilter.getAttribute('aria-expanded'), 'true', `${browserName}: F opens + Filter`)
      await statusOption.click()
      const statusMenu = page.locator('[aria-label="Condition on Status"]')
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).waitFor()
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).click()
      await page.waitForURL((u) => u.searchParams.has('where'))
      await page.keyboard.press('Escape')
      await page.locator('h1').first().hover()

      // Clicking the chip (not its ×) reopens its popover, the value it
      // keeps checked.
      const statusChip = page.locator('.bar .chip', { hasText: `Status: ${a}` })
      await statusChip.waitFor()
      await statusChip.getByRole('button', { name: new RegExp(`^Status: ${a}`) }).click()
      await statusMenu.waitFor()
      assert.equal(await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).getAttribute('aria-checked'), 'true', `${browserName}: the chip reopens on the value it keeps`)
      await page.keyboard.press('Escape')
      await page.locator('h1').first().hover()

      // Its own × removes it too.
      await statusChip.getByRole('button', { name: 'Remove the Status filter' }).click()
      await page.waitForURL((u) => !u.searchParams.has('where'))
      await statusChip.waitFor({ state: 'detached' })
      assert.equal(await page.locator('.bar .chip', { hasText: 'Status:' }).count(), 0, `${browserName}: × removes the condition at once`)

      // A filter in the address is shareable and survives a reload.
      const direct = `${base}/expenses?view=list&by=&sort=&where=${encodeURIComponent(JSON.stringify([{ field: 'status', is: [a] }]))}`
      await page.goto(direct)
      await page.waitForLoadState('networkidle')
      await page.locator('.bar .chip', { hasText: `Status: ${a}` }).waitFor()
      await page.reload()
      await page.waitForLoadState('networkidle')
      assert.equal(new URL(page.url()).searchParams.get('where'), JSON.stringify([{ field: 'status', is: [a] }]), `${browserName}: the filter survives a reload, in the address`)
      await page.locator('.bar .chip', { hasText: `Status: ${a}` }).waitFor()
      mkdirSync(shots, { recursive: true })
      await page.screenshot({ path: `${shots}/bar-1280-${browserName}.png` })

      // On a phone the bar's chips scroll sideways; the page itself never
      // wraps wider than the viewport.
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(phone, base, julien)
      // Shut, so the screenshot shows the collection, the bar above it,
      // not the View panel over it.
      await phone.addCookies([{ name: 'cella-drawer', value: 'closed', url: base }])
      const phonePage = await phone.newPage()
      await phonePage.goto(direct)
      await phonePage.waitForLoadState('networkidle')
      await phonePage.locator('.bar .chip', { hasText: `Status: ${a}` }).waitFor()
      await phonePage.screenshot({ path: `${shots}/bar-390-${browserName}.png` })
      const widths = await phonePage.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }))
      assert.ok(widths.doc <= widths.view + 1, `${browserName}: at 390px the page itself does not scroll wider (${widths.doc} vs ${widths.view})`)
      const overflowsX = await phonePage.locator('.bar .chips').evaluate((el) => el.scrollWidth > el.clientWidth || getComputedStyle(el).overflowX === 'auto')
      assert.ok(overflowsX, `${browserName}: at 390px the chips scroll sideways within the bar`)
      await phone.close()

      // Save and Reset, at the bar's end, once the view differs from All.
      await page.goto(`${base}/expenses`)
      await page.waitForLoadState('networkidle')
      await choose(page.getByRole('combobox', { name: 'Filter' }), { label: 'Status' })
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).waitFor()
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).click()
      await page.waitForURL((u) => u.searchParams.has('where'))
      await page.keyboard.press('Escape')
      await page.locator('h1').first().hover()
      await page.getByRole('button', { name: 'Save', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Reset', exact: true }).click()
      await page.waitForURL((u) => !u.searchParams.has('where'))
      await page.locator('.content > div.bar').waitFor({ state: 'detached' })
      assert.equal(await page.locator('.content > div.bar').count(), 0, `${browserName}: Reset returns to All's own form, the bar folding back into the header`)

      // Save, through the View panel's own naming form, since All is no
      // viewer's own.
      await choose(page.getByRole('combobox', { name: 'Filter' }), { label: 'Status' })
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).waitFor()
      await statusMenu.locator(`[role="menuitemcheckbox"][data-value="${a}"]`).click()
      await page.waitForURL((u) => u.searchParams.has('where'))
      await page.keyboard.press('Escape')
      await page.locator('h1').first().hover()
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await panel(page).getByLabel('View name').fill('Status a')
      await panel(page).getByRole('button', { name: 'Save view' }).click()
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await page.waitForLoadState('networkidle')
      await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ state: 'detached' })
      assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 0, `${browserName}: Save is gone once the view is saved`)
      const savedChip = page.locator('.bar .chip', { hasText: `Status: ${a}` })
      await savedChip.waitFor()
      assert.equal(await savedChip.locator('.dot').count(), 0, `${browserName}: the saved view's own chip draws plain, no dot`)

      assert.deepEqual(errors, [], `${browserName}: no page error`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
