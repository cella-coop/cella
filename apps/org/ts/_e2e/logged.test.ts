// Every record shows when and by whom it was created and last updated, as
// the log has it, in every browser, light and dark. Camille adds a
// contact on 24 October, Julien another on the 25th and updates the
// first on the 26th, the day the dev server is at. Contacts hold no date
// and no person of their own, yet their View panel offers a calendar,
// which places the two by Created, and a list, once Display shows who
// created each and when; a table orders them by Updated either way, a row the log names
// none of last; Filter keeps Julien's by Created by; the first's page
// ends its properties with its four. A meeting's calendar still places
// them by their start, and an invoice's by the day it is due, with
// Created and Updated among the dates it offers. `SHOTS` names where its
// screenshots go. Run by `cella test e2e logged`.
// covers: contact invoice meeting

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { add, update } from '@cella/org-contact/api'
import type { Deps } from '@cella/org-db'
import { eachBrowser, serve, signIn } from './browser.ts'
import { choose, chosen, offered } from './controls.ts'
import { reader, sign } from './lanterne.ts'

const camille = 'camille@lanterne.example'
const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-logged-shots'
const su = new pg.Client()
let app: pg.Client

// The scope's day, for the writes after it and the server started then.
async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const settled = (out: { state: string; reason?: string }) => assert.equal(out.state, 'settled', out.reason)

before(async () => {
  await su.connect()
  await on('2026-10-24')
  settled(await add({ id: 'logged-estampe', kind: 'company', name: 'Atelier Estampe' }, as(camille)))
  await on('2026-10-25')
  settled(await add({ id: 'logged-tampon', kind: 'company', name: 'Bureau Tampon' }, as(julien)))
  await on('2026-10-26')
  settled(await update({ id: 'logged-estampe', fields: { note: 'met at the fair' } }, as(julien)))
})

after(async () => {
  await app.end()
  await su.end()
})

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// The contacts a table draws, by id, in its order.
const listed = (page: Page) =>
  page.locator('table tbody tr a.stretched').evaluateAll((as) => as.map((a) => decodeURIComponent((a.getAttribute('href') ?? '').replace(/^\/contacts\//, ''))))

// Polls what the page draws until it holds, then asserts it.
async function until<T>(read: () => Promise<T>, holds: (x: T) => boolean, message: string) {
  let last = await read()
  for (let tries = 0; tries < 60 && !holds(last); tries++) {
    await new Promise((r) => setTimeout(r, 250))
    last = await read()
  }
  assert.ok(holds(last), `${message}: ${JSON.stringify(last)}`)
}

eachBrowser((browserName, launch) => {
  test(`${browserName}: a collection with no date of its own offers a calendar by Created, a table orders by Updated and filters by Created by, and a record's page ends with its four, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${browserName}, ${scheme}`
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
        const visit = async (path: string) => {
          await page.goto(`${base}${path}`)
          await page.waitForLoadState('networkidle')
        }
        const layout = async (name: string) => {
          await panel(page).getByRole('button', { name, exact: true }).click()
          await page.waitForURL((u) => u.searchParams.get('view') === name.toLowerCase())
          await page.waitForLoadState('networkidle')
          // The panel says the layout once the page has drawn it, so what is
          // changed next is changed from it.
          await until(() => panel(page).getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), (p) => p === 'true', `${name} is drawn`)
        }
        const date = () => panel(page).getByRole('combobox', { name: 'Group by' })

        // A calendar of contacts, by Created: each on the day it was added;
        // grouped by nothing, so the table later reads as one.
        await visit('/contacts?by=')
        await layout('Calendar')
        await until(() => chosen(date()), (v) => v === 'created', `${at}: the calendar places contacts by Created`)
        const day = (d: string) => page.locator(`.calendar li.day[aria-label^="${d},"] li.entry`)
        await until(() => day('2026-10-24').allInnerTexts(), (t) => t.some((x) => x.includes('Atelier Estampe')), `${at}: Camille's contact sits on the 24th`)
        await until(() => day('2026-10-25').allInnerTexts(), (t) => t.some((x) => x.includes('Bureau Tampon')), `${at}: Julien's sits on the 25th`)
        assert.equal(await page.locator('.calendar li.entry').count(), 2, `${at}: a contact the founding carried in sits nowhere`)
        await page.screenshot({ path: `${shots}/contacts-calendar-${browserName}-${scheme}.png`, fullPage: true })

        // A list of them, who created each and when, once Display shows
        // them: contacts hold neither by default. List is already the
        // collection's own layout, so choosing it leaves `view` out of
        // the address; `layout`'s wait for it would never resolve.
        await panel(page).getByRole('button', { name: 'List', exact: true }).click()
        await page.waitForLoadState('networkidle')
        await until(() => panel(page).getByRole('button', { name: 'List', exact: true }).getAttribute('aria-pressed'), (p) => p === 'true', `${at}: List is drawn`)
        await panel(page).getByRole('button', { name: /^\d+ fields$/ }).click()
        const display = page.getByRole('dialog', { name: 'Display' })
        await display.waitFor()
        await display.getByRole('checkbox', { name: 'Created by', exact: true }).check()
        await display.getByRole('checkbox', { name: 'Created', exact: true }).check()
        await page.keyboard.press('Escape')
        const line = (name: string) => page.locator('ul.list > li', { hasText: name })
        await until(() => line('Atelier Estampe').locator('.meta .person').getAttribute('title'), (t) => t === camille, `${at}: the list names who created the first`)
        await until(() => line('Bureau Tampon').locator('.meta .person').getAttribute('title'), (t) => t === julien, `${at}: and the second`)
        assert.notEqual((await line('Atelier Estampe').locator('.meta .dated').innerText()).trim(), '—', `${at}: and when`)
        await page.screenshot({ path: `${shots}/contacts-list-${browserName}-${scheme}.png`, fullPage: true })

        // A table ordered by Updated, either way, a row with none last.
        await layout('Table')
        await choose(panel(page).getByRole('combobox', { name: 'Order by' }), { label: 'Updated' })
        await page.waitForURL((u) => u.searchParams.get('sort') === 'updated')
        await until(() => listed(page), (ids) => ids[0] === 'logged-tampon' && ids[1] === 'logged-estampe', `${at}: by Updated, the 25th's first`)
        await panel(page).getByRole('button', { name: 'Ascending' }).click()
        await page.waitForURL((u) => u.searchParams.get('sort') === '-updated')
        await until(() => listed(page), (ids) => ids[0] === 'logged-estampe' && ids[1] === 'logged-tampon', `${at}: descending, the 26th's first`)

        // Filtered by Created by: Julien's alone.
        await choose(panel(page).getByRole('combobox', { name: 'Filter' }), { label: 'Created by' })

        const his = page.locator(`[role="menuitemcheckbox"][data-value="${julien}"]`)
        await his.waitFor()
        await his.click()
        await page.waitForURL((u) => u.searchParams.has('where'))
        assert.deepEqual(JSON.parse(new URL(page.url()).searchParams.get('where') ?? '[]'), [{ field: 'created_by', is: [julien] }])
        await page.keyboard.press('Escape')
        await panel(page).getByRole('heading', { name: 'View', exact: true }).hover()
        await until(() => listed(page), (ids) => ids.length === 1 && ids[0] === 'logged-tampon', `${at}: Created by Julien keeps his contact alone`)

        // The first's page: its properties end with its four.
        await visit('/contacts/logged-estampe')
        const props = await page.locator('dl.props').first().evaluate((dl) =>
          [...dl.querySelectorAll('dt')].map((dt) => {
            const dd = dt.nextElementSibling
            return { label: dt.textContent?.trim() ?? '', text: dd?.textContent?.trim() ?? '', who: dd?.querySelector('.person')?.getAttribute('title') ?? null }
          }),
        )
        const last = props.slice(-4)
        assert.deepEqual(last.map((p) => p.label), ['Created', 'Updated', 'Created by', 'Updated by'], `${at}: the page's properties end with the four`)
        assert.ok(last[0].text !== '—' && last[1].text !== '—' && last[0].text !== last[1].text, `${at}: created and updated on two days`)
        assert.deepEqual([last[2].who, last[3].who], [camille, julien], `${at}: created by Camille, updated by Julien`)
        await page.screenshot({ path: `${shots}/contact-${browserName}-${scheme}.png`, fullPage: true })

        // A meeting's calendar by its start, an invoice's by its due day,
        // each offering Created and Updated beside.
        for (const [path, want] of [
          ['/meetings', 'at'],
          ['/invoices?view=calendar', 'due'],
        ]) {
          await visit(path)
          assert.equal(await chosen(date()), want, `${at}: ${path} places its rows by ${want}`)
          const values = (await offered(date())).map((o) => o.value)
          assert.ok(values.includes('created') && values.includes('updated'), `${at}: ${path} offers Created and Updated: ${values}`)
        }

        assert.deepEqual(errors, [], `${at}: no page error`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
