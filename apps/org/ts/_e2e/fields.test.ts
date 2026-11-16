// A view chooses the fields it shows in every layout but the dashboard,
// in every browser: signed in as Julien on the dev server, the files in
// a list show their id under each row's title and their kind, size and
// day after it, by their columns' roles; Display hides the size and the
// id and shows the type, a column the table alone shows by default,
// after the title, and the address keeps the choice as `cards`. In a
// feed the files show nothing after each line's title but what Display
// chooses, offering every field but the title, who and when; it shows
// their kind and type. A view saved with its fields restores them from
// its tab, and the address alone draws them. In a table, a gallery, on
// a board and in a calendar, a field taken away in Display is one fewer
// shown. `SHOTS` names where its screenshots go. Nothing is written. Run
// by `cella test e2e fields`.
// covers: file meeting task

import { test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const julien = 'julien@lanterne.example'
const shots = process.env.SHOTS ?? '/tmp/cella-fields-shots'

const panel = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })

// What the first row of a list or a feed draws: how many fields under or
// beside its title, how many after it, and how many of those are mono,
// as the id and the type are.
async function first(page: Page, layout: 'list' | 'feed') {
  const row = page.locator(layout === 'list' ? 'ul.list > li:not(.group)' : 'ol.feed > li:not(.group)').first()
  await row.waitFor()
  return {
    sub: await row.locator('.main .sub').count(),
    meta: await row.locator('.meta > *').count(),
    mono: await row.locator('.main .sub .mono, .meta .mono').count(),
  }
}

// Polls until the first row draws what `want` says.
async function draws(page: Page, layout: 'list' | 'feed', want: { sub: number; meta: number; mono: number }, at: string) {
  let last = await first(page, layout)
  for (let tries = 0; tries < 60 && JSON.stringify(last) !== JSON.stringify(want); tries++) {
    await page.waitForTimeout(250)
    last = await first(page, layout)
  }
  assert.deepEqual(last, want, at)
}

eachBrowser((browserName, launch) => {
  test(`${browserName}: a list and a feed show the fields their view chooses, saved in a view and in the address, and every layout's Display changes what shows`, async () => {
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, julien)
      const page = await context.newPage()
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
      const cards = (u: URL) => u.searchParams.get('cards')
      const display = () => page.getByRole('dialog', { name: 'Display' })
      // A field shown or hidden in Display's popover, the address it leads
      // to, and the panel's count once the page has followed it, so the
      // next field chosen is chosen among what it shows.
      const field = async (label: string, on: boolean, want: string) => {
        await display().getByRole('checkbox', { name: label, exact: true }).setChecked(on)
        await page.waitForURL((u) => cards(u) === want)
        await panel(page).getByRole('button', { name: new RegExp(`(^|\\s)${want.split(',').length} fields$`) }).waitFor()
      }
      const save = async (name: string) => {
        await panel(page).getByRole('button', { name: 'Save as view' }).click()
        await panel(page).getByLabel('View name').fill(name)
        await panel(page).getByRole('button', { name: 'Save view' }).click()
        await page.waitForURL((u) => u.searchParams.get('v')?.startsWith('c-') ?? false)
      }

      // A list: by the columns' roles, then as Display chooses.
      await visit('/files?view=list')
      await draws(page, 'list', { sub: 1, meta: 3, mono: 1 }, `${browserName}: a list shows its columns by their roles`)
      await panel(page).getByRole('button', { name: '4 fields' }).click()
      await display().waitFor()
      assert.deepEqual(
        await display().getByRole('checkbox').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-checked') === 'true')),
        [true, true, true, true, false, false, false, false, false, false],
        `${browserName}: a list's Display offers every field but the title, the logged ones last, those its roles show checked`,
      )
      await field('Size', false, 'id,class,uploaded')
      await field('Type', true, 'id,class,uploaded,type')
      await field('Id', false, 'class,uploaded,type')
      await page.keyboard.press('Escape')
      const listed = { sub: 0, meta: 3, mono: 1 }
      await draws(page, 'list', listed, `${browserName}: the list shows the kind, the day and the type after the title`)
      mkdirSync(shots, { recursive: true })
      await page.screenshot({ path: `${shots}/files-list-${browserName}.png` })
      await save('Chosen fields')
      await visit('/files?view=list')
      await draws(page, 'list', { sub: 1, meta: 3, mono: 1 }, `${browserName}: the list's default is back`)
      await page.getByTitle(/^View Chosen fields /).click()
      await page.waitForURL((u) => cards(u) === 'class,uploaded,type')
      await draws(page, 'list', listed, `${browserName}: the saved view restores the list's fields`)
      await visit('/files?view=list&cards=class,uploaded,type')
      await draws(page, 'list', listed, `${browserName}: the address alone draws the list's fields`)

      // A feed: nothing after its title, then as Display chooses.
      await visit('/files?view=feed')
      await draws(page, 'feed', { sub: 0, meta: 0, mono: 0 }, `${browserName}: a feed shows who, what and when`)
      await panel(page).getByRole('button', { name: '0 fields' }).click()
      await display().waitFor()
      assert.deepEqual(
        await display().getByRole('checkbox').evaluateAll((bs) => bs.map((b) => b.parentElement?.textContent?.trim())),
        ['Id', 'Kind', 'Size', 'Type', 'Created', 'Updated', 'Created by', 'Updated by'],
        `${browserName}: a feed's Display offers every field but the title, who and when, the logged ones last`,
      )
      await field('Kind', true, 'class')
      await field('Type', true, 'class,type')
      await page.keyboard.press('Escape')
      const fed = { sub: 2, meta: 0, mono: 1 }
      await draws(page, 'feed', fed, `${browserName}: the feed shows the kind and the type after the title`)
      await page.screenshot({ path: `${shots}/files-feed-${browserName}.png` })
      await save('Fed fields')
      await visit('/files?view=feed')
      await draws(page, 'feed', { sub: 0, meta: 0, mono: 0 }, `${browserName}: the feed's default is back`)
      await page.getByTitle(/^View Fed fields /).click()
      await page.waitForURL((u) => cards(u) === 'class,type')
      await draws(page, 'feed', fed, `${browserName}: the saved view restores the feed's fields`)
      await visit('/files?view=feed&cards=class,type')
      await draws(page, 'feed', fed, `${browserName}: the address alone draws the feed's fields`)

      // Every other layout but the dashboard: a field taken away in
      // Display is one fewer shown, as its row in the panel counts it.
      for (const [path, noun] of [
        ['/files?view=table', 'columns'],
        ['/files?view=gallery', 'card fields'],
        ['/tasks?view=board', 'card fields'],
        ['/meetings?view=calendar', 'card fields'],
      ]) {
        await visit(path)
        const button = panel(page).getByRole('button', { name: new RegExp(`^\\d+ ${noun}$`) })
        const count = async () => Number((await button.textContent())?.trim().split(' ')[0])
        const before = await count()
        await button.click()
        await display().waitFor()
        await display().locator('[role=checkbox][aria-checked=true]:not(:disabled)').first().uncheck()

        await page.waitForURL((u) => u.searchParams.has(noun === 'columns' ? 'hide' : 'cards'))
        await page.keyboard.press('Escape')
        for (let tries = 0; tries < 60 && (await count()) !== before - 1; tries++) {
          await page.waitForTimeout(250)
        }
        assert.equal(await count(), before - 1, `${browserName}: ${path}'s Display shows one fewer`)
      }

      assert.deepEqual(errors, [], `${browserName}: no page error`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
    }
  })
})
