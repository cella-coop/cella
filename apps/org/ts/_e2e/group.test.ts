// A view groups its rows by an enumeration, a person or a circle (or, as D adds, a record link, a boolean or a text field of few values), in
// every browser: signed in as Julien on the dev server, the expenses
// grouped by their status, an enumeration, in a list, a table, a gallery
// and on a board; the files, by who
// uploaded them, a person, in a list, a table, a gallery and on a
// board; and the mandates by the circle that issued them, a circle, in a
// list, a table, a gallery and on a board. Group by offers each field and
// None; a board's Columns offers each field too, but never None, migrated
// from an older view's grouping where it is unset. A list, a table and a
// gallery draw a header over each
// group's rows, naming its value, a person and a circle by name, and how
// many rows it holds, the groups in the order a board's columns take and
// the rows in the collection's order within each, as the scenario works
// them out from the rows themselves; a board draws a column per value. A
// view saved with its group restores it from its tab, the address alone
// draws it, and None draws the rows as one again. In a table, a group's
// bar collapses its own rows alone by its chevron, and its + ("Create
// in …", never named New) opens New's own dialog (F32). Setting a board's
// Grouping too, its swimlanes wear the same bar, collapsible the same
// way, each holding the whole set of columns, Columns locked at what
// already drew. `SHOTS` names
// where its screenshots go. Nothing is written but what New's cancel
// undoes. Run
// by `cella test e2e group`.
// covers: expense file

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { page as read, type Source } from '@cella/org-db'
import { statuses } from '@cella/org-expense/models'
import { people } from '@cella/org-person/api'
import { source } from '#lib/server/slices.ts'
import { eachBrowser, serve, signIn } from './browser.ts'
import { choose, chosen } from './controls.ts'

const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-group-shots'
const app = new pg.Client({ user: 'cella_app' })

before(async () => {
  await app.connect()
  await app.query(`SELECT set_config('cella.actor', $1, false)`, [julien])
})

after(async () => {
  await app.end()
})

type Row = Record<string, unknown> & { id: string }

// A group as a layout draws it: its value's label, how many rows its
// header says it holds, and the ids it draws, in order.
interface Drawn {
  label: string
  count: number
  ids: string[]
}

const value = (r: Row, key: string) => (r[key] === null || r[key] === undefined ? '' : String(r[key]))

// The groups a collection's rows fall in by `key`, worked out from the
// rows in the collection's order: the `given` values first, in their
// order, any other after them by value, the rows with none last, each
// group's rows in the collection's order.
async function expected(name: string, key: string, given: string[], label: (v: string) => string): Promise<Drawn[]> {
  const rows = (await read(app, source(name) as Source, { where: [] })) as Row[]
  const vs = [...new Set(rows.map((r) => value(r, key)))]
  const rank = (v: string) => (v === '' ? 2 : given.includes(v) ? 0 : 1)
  vs.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? given.indexOf(a) - given.indexOf(b) : a < b ? -1 : a > b ? 1 : 0))
  return vs.map((v) => {
    const ids = rows.filter((r) => value(r, key) === v).map((r) => r.id)
    return { label: v === '' ? 'None' : label(v), count: ids.length, ids }
  })
}

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// The groups a layout draws: a board's columns, each its heading and its
// cards; else each header and the rows under it, in document order.
async function drawn(page: Page, name: string, layout: string): Promise<Drawn[]> {
  // The collection's rows, not the View panel's.
  const rows = page.locator('div.rows:not(:has(> .label))')
  return rows.evaluate(
    (el, [prefix, board]) => {
      const id = (a: Element) => decodeURIComponent(new URL((a as HTMLAnchorElement).href).pathname.slice(prefix.length))
      const head = (h: Element | null) => {
        const count = h?.querySelector('.count')
        // Value's own text, not the header's whole: a person's or a
        // record's group leads with an avatar or an icon, its own text
        // (initials, none) run straight against the name with no space;
        // a board's lane, a card-sized Value, drops a person's name for
        // its avatar alone and keeps it only in the value's own title.
        const label = [...(h?.children ?? [])]
          .filter((c) => c !== count && c.tagName !== 'BUTTON')
          .map((c) => (c.querySelector('.text')?.textContent ?? (c as HTMLElement).getAttribute?.('title') ?? c.textContent ?? '').trim())
          .join(' ')
        return { label, count: Number(count?.textContent ?? -1) }
      }
      const out: { label: string; count: number; ids: string[] }[] = []
      if (board) {
        // The column headers are one row over the columns, the nth over
        // the nth.
        const heads = [...el.querySelectorAll('.head h3')]
        el.querySelectorAll('section.lane').forEach((lane, i) => {
          const ids = [...lane.querySelectorAll(`a[href^="${prefix}"]`)].map(id)
          out.push({ ...head(heads[i] ?? null), ids })
        })
        return out
      }
      for (const n of el.querySelectorAll(`li.group, tr.group, a[href^="${prefix}"]`)) {
        if (n.matches('.group')) {
          out.push({ ...head(n.querySelector('span.group')), ids: [] })
        } else {
          const ids = out.at(-1)?.ids
          const i = id(n)
          if (ids && i && ids.at(-1) !== i) {
            ids.push(i)
          }
        }
      }
      return out
    },
    [`/${name}/`, layout === 'board'] as const,
  )
}

// Polls until the layout draws the groups `want` says: a list, a
// table and a gallery each group, its header's label and count and its
// rows, in order; a board each column that holds a row, the rows with
// none being in none.
async function groups(page: Page, name: string, layout: string, want: Drawn[], at: string) {
  const wanted = layout === 'board' ? want.filter((g) => g.label !== 'None') : want
  let last: Drawn[] = []
  for (let tries = 0; tries < 60; tries++) {
    last = await drawn(page, name, layout)
    const got = layout === 'board' ? last.filter((g) => g.ids.length > 0) : last
    if (JSON.stringify(got) === JSON.stringify(wanted)) {
      return
    }
    await page.waitForTimeout(250)
  }
  assert.fail(`${at}: drawn ${JSON.stringify(last)}, wanted ${JSON.stringify(wanted)}`)
}

eachBrowser((browserName, launch) => {
  test(`${browserName}: every layout but the calendar groups by an enumeration, a person and a circle, saved in a view and in the address`, async () => {
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

      // Group by a field in the View panel, or a board's Columns: either
      // offers it, the address takes it (`by`, or a board's `columns`,
      // which `by` still means until it is set) and the layout draws its
      // groups.
      const grouping = async (name: string, layout: string, field: { key: string; label: string }, want: Drawn[]) => {
        const view = panel(page)
        assert.equal(await view.getByRole('button', { name: layout[0].toUpperCase() + layout.slice(1), exact: true }).getAttribute('aria-pressed'), 'true', `${browserName}: ${name} in a ${layout}`)
        const label = layout === 'board' ? 'Columns' : 'Group by'
        const param = layout === 'board' ? 'columns' : 'by'
        const by = view.getByRole('combobox', { name: label })
        if (layout !== 'board') {
          assert.equal(await chosen(by), '', `${browserName}: ${name}'s ${layout} groups by nothing at first`)
        }
        // A board already columned by the field keeps it: choosing it
        // again changes nothing, as the browser's own select did not.
        if ((await chosen(by)) !== field.key) {
          await choose(by, { label: field.label })
          // The address names the field, or nothing where it is the one the
          // collection groups by.
          await page.waitForURL((u) => u.searchParams.get(param) === field.key || !u.searchParams.has(param))
        }

        await view.getByRole('heading', { name: 'View', exact: true }).hover()
        await groups(page, name, layout, want, `${browserName} ${name} ${layout} by ${field.key}`)
      }

      // A person, by name.
      const names = Object.fromEntries((await people(app)).map((p) => [p.address, p.name]))

      // An enumeration, in its board's declared order.
      const byStatus = await expected('expenses', 'status', [...statuses], (v) => v)
      assert.ok(byStatus.length > 1, 'expenses stand in more than one status')
      for (const layout of ['list', 'table', 'gallery', 'board']) {
        // Grouped by nothing and in the collection's own order, the start
        // the scenario works its groups out from.
        await visit(`/expenses?view=${layout}&by=&sort=`)
        await grouping('expenses', layout, { key: 'status', label: 'Status' }, byStatus)
      }

      // A table's group header: a bar, its chevron collapsing its own
      // rows alone, its + opening New (`Group.svelte`, F32).
      await visit('/expenses?view=table&by=status&sort=')
      await groups(page, 'expenses', 'table', byStatus, `${browserName}: before collapsing`)
      const expenseRows = () => page.locator('div.rows:not(:has(> .label)) tbody tr:not(.group)')
      const bar = page.locator('tr.group').first()
      const until = async (n: number, at: string) => {
        let got = -1
        for (let tries = 0; tries < 40 && got !== n; tries++) {
          got = await expenseRows().count()
          if (got !== n) {
            await page.waitForTimeout(100)
          }
        }
        assert.equal(got, n, at)
      }
      const whole = await expenseRows().count()
      await bar.getByRole('button', { name: /^Hide /, exact: false }).click()
      await until(whole - byStatus[0].count, `${browserName}: the chevron hides its own group's rows alone`)
      await bar.getByRole('button', { name: /^Show /, exact: false }).click()
      await until(whole, `${browserName}: it shows them again`)
      await bar.getByRole('button', { name: /^Create in /, exact: false }).click()
      await page.getByRole('dialog', { name: 'New in Expenses' }).waitFor()
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Setting a board's Grouping too, as the operator asked: the
      // expenses split into a swimlane per member, each the whole set of
      // status columns, Columns locking in at status, which already drew.
      await visit('/expenses?view=board&by=&sort=')
      const byMember = await expected('expenses', 'member', [], (v) => names[v] ?? v)
      const members = byMember.filter((g) => g.label !== 'None')
      assert.ok(members.length > 1, `${browserName}: more than one member submitted the expenses Julien reads`)
      {
        const view = panel(page)
        assert.equal(await chosen(view.getByRole('combobox', { name: 'Columns' })), 'status', `${browserName}: Columns already drew status`)
        await choose(view.getByRole('combobox', { name: 'Grouping' }), { label: 'Member' })
        await page.waitForURL((u) => u.searchParams.get('by') === 'member')
        // Columns stays status: locked in rather than stolen by Grouping.
        assert.equal(await chosen(view.getByRole('combobox', { name: 'Columns' })), 'status', `${browserName}: Grouping locks Columns at status`)
        assert.equal(new URL(page.url()).searchParams.get('columns'), 'status', `${browserName}: the address names Columns too`)

        const prefix = '/expenses/'
        const swum = () =>
          page.locator('section.swimlane').evaluateAll(
            (els, prefix) =>
              els.map((el) => {
                const bar = el.querySelector('span.group')
                const count = bar?.querySelector('.count')
                // Value's own span, not the bar's: a person's or a
                // record's group header leads with an avatar or an icon,
                // whose own text (initials, none) sits right against it
                // with no space between, so reading the whole bar's text
                // runs them together.
                const label = [...(bar?.children ?? [])]
                  .filter((c) => c !== count)
                  .map((c) => (c.querySelector('.text')?.textContent ?? c.textContent ?? '').trim())
                  .join(' ')
                const columns = el.querySelectorAll('section.lane').length
                const ids = [...el.querySelectorAll(`a[href^="${prefix}"]`)].map((a) => decodeURIComponent(new URL((a as HTMLAnchorElement).href).pathname.slice(prefix.length)))
                return { label, count: Number(count?.textContent ?? -1), columns, ids }
              }),
            prefix,
          )
        let lanes: { label: string; count: number; columns: number; ids: string[] }[] = []
        for (let tries = 0; tries < 60; tries++) {
          lanes = await swum()
          if (lanes.length === members.length) {
            break
          }
          await page.waitForTimeout(250)
        }
        assert.equal(lanes.length, members.length, `${browserName}: a swimlane per member`)
        for (const m of members) {
          const got = lanes.find((l) => l.label === m.label)
          assert.ok(got, `${browserName}: a swimlane for ${m.label}`)
          assert.equal(got!.count, m.count, `${browserName}: ${m.label}'s swimlane counts its own rows`)
          assert.equal(got!.columns, statuses.length, `${browserName}: ${m.label}'s swimlane holds the whole set of columns`)
          assert.deepEqual([...got!.ids].sort(), [...m.ids].sort(), `${browserName}: ${m.label}'s swimlane holds its own rows`)
        }
        mkdirSync(shots, { recursive: true })
        await page.screenshot({ path: `${shots}/expenses-swimlanes-${browserName}.png` })

        // The swimlane's bar collapses the same way a list group's does.
        const first = page.locator('section.swimlane').first()
        const untilLanes = async (want: (n: number) => boolean, at: string) => {
          let got = -1
          for (let tries = 0; tries < 40 && !want(got); tries++) {
            got = await first.locator('section.lane').count()
            if (!want(got)) {
              await page.waitForTimeout(100)
            }
          }
          assert.ok(want(got), `${at}: ${got}`)
        }
        await first.getByRole('button', { name: /^Hide /, exact: false }).click()
        await untilLanes((n) => n === 0, `${browserName}: the swimlane's chevron hides its columns`)
        await first.getByRole('button', { name: /^Show /, exact: false }).click()
        await untilLanes((n) => n > 0, `${browserName}: it shows them again`)
      }

      const byUploader = await expected('files', 'uploader', [], (v) => names[v] ?? v)
      assert.ok(byUploader.length > 1, 'more than one person uploaded the files Julien reads')
      for (const layout of ['list', 'table', 'gallery', 'board']) {
        await visit(`/files?view=${layout}&by=&sort=`)
        await grouping('files', layout, { key: 'uploader', label: 'By' }, byUploader)
      }

      // A circle, by name.
      const circles = Object.fromEntries((await app.query<{ id: string; name: string }>('SELECT id, name FROM circle.circle')).rows.map((c) => [c.id, c.name]))
      const byIssuer = await expected('mandates', 'issuer', [], (v) => circles[v] ?? v)
      assert.ok(byIssuer.length > 1, 'more than one circle issued the mandates')
      for (const layout of ['list', 'table', 'gallery', 'board']) {
        await visit(`/mandates?view=${layout}&by=&sort=`)
        await grouping('mandates', layout, { key: 'issuer', label: 'Issued by' }, byIssuer)
      }

      // A view saved with its group restores it from its tab.
      await visit('/mandates?view=list&by=issuer&sort=')
      await groups(page, 'mandates', 'list', byIssuer, `${browserName}: before saving`)
      await panel(page).getByRole('button', { name: 'Save', exact: true }).click()
      await page.getByLabel('Rename view Untitled view').fill('By issuer')
      await page.getByLabel('Rename view Untitled view').press('Enter')
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await visit('/mandates?view=list&by=')
      assert.equal(await drawn(page, 'mandates', 'list').then((d) => d.length), 0, `${browserName}: the list groups by nothing`)
      await page.getByTitle(/^View By issuer /).click()
      await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      await groups(page, 'mandates', 'list', byIssuer, `${browserName}: the saved view`)

      // The address alone draws the group, from the server.
      await visit('/mandates?view=table&by=issuer&sort=')
      await groups(page, 'mandates', 'table', byIssuer, `${browserName}: the address`)
      mkdirSync(shots, { recursive: true })
      await page.screenshot({ path: `${shots}/mandates-${browserName}.png` })
      await visit('/files?view=list&by=uploader&sort=')
      await groups(page, 'files', 'list', byUploader, `${browserName}: the list's address`)
      await page.screenshot({ path: `${shots}/files-${browserName}.png` })

      // None draws the rows as one again.
      await choose(panel(page).getByRole('combobox', { name: 'Group by' }), { label: 'None' })

      await page.waitForURL((u) => u.searchParams.get('by') === '')
      for (let tries = 0; tries < 60 && (await drawn(page, 'files', 'list')).length > 0; tries++) {
        await page.waitForTimeout(250)
      }
      assert.equal((await drawn(page, 'files', 'list')).length, 0, `${browserName}: None draws no header`)

      assert.deepEqual(errors, [], `${browserName}: no page error`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
