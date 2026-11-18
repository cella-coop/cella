// New opens every collection's create form in the one Dialog, on a seeded
// Lanterne through the built shell, in light and in dark, on each browser
// `BROWSERS` names. On every collection the sidebar mounts that has a New,
// its button and its C each open the dialog over the page, holding the
// create form, which ends in Cancel and its confirming button, and no
// create form is drawn on the page; Cancel, Escape and a click outside
// each close it, the collection's count as it was. Thomas creates a task
// from it: the dialog closes and the task is among the rows. Sofia, who
// holds no mandate to record a bill, is refused: the dialog stays open,
// the guard's reason inside it and what she typed still there. Run by
// `cella test e2e new`.
// covers: all

import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'
const thomas = 'thomas@lanterne.example'
const sofia = 'sofia@lanterne.example'

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

const context = (browser: Browser, scheme: 'light' | 'dark') =>
  browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })

const visit = async (page: Page, base: string, path: string) => {
  await page.goto(`${base}${path}`)
  await page.waitForLoadState('networkidle')
}

// Every collection the sidebar mounts for Camille, in each circle she
// looks through, Settings' among them, as the accessibility scan finds
// them.
async function collections(ctx: BrowserContext, base: string): Promise<string[]> {
  const page = await ctx.newPage()
  const nav = page.getByRole('navigation', { name: 'Main' })
  const shut = nav.locator('button.head[aria-expanded="false"]')
  const links = () => nav.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
  const hrefs: string[] = []
  for (const lens of ['operations', 'web', '']) {
    await ctx.addCookies([{ name: 'cella-lens', value: lens, url: base }])
    await visit(page, base, '/')
    for (let left = 20; left > 0 && (await shut.count()) > 0; left--) {
      await shut.first().click()
    }
    hrefs.push(...(await links()))
  }
  await ctx.addCookies([{ name: 'cella-lens', value: '', url: base }])
  await visit(page, base, '/settings/account')
  hrefs.push(...(await links()))
  await page.close()
  return [...new Set(hrefs)].filter((h) => h !== '/' && !h.includes('?'))
}

// New's dialog, open, and the forms it holds.
const dialog = (page: Page) => page.locator('dialog[open]')
const closed = async (page: Page, how: string, path: string) => {
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  assert.equal(await dialog(page).count(), 0, `${how} closes New on ${path}`)
}
const count = (page: Page) => page.locator('header.top .count').textContent()

// Opens New on a collection's page and checks what it holds: a create
// form ending in Cancel and its confirming button, inside the dialog, and
// none on the page.
async function opened(page: Page, path: string, how: string) {
  const open = dialog(page)
  await open.waitFor({ timeout: 5000 })
  const forms = open.locator('form')
  assert.ok((await forms.count()) > 0, `${how} opens New's dialog holding a form on ${path}`)
  for (const form of await forms.all()) {
    const buttons = await form.locator(':scope > .submit button').allTextContents()
    assert.equal(buttons.length, 2, `${path}: a create form ends in two buttons, ${buttons.join(', ')}`)
    assert.equal(buttons[0].trim(), 'Cancel', `${path}: Cancel, then the button that confirms`)
  }
  assert.equal(await page.locator('form[data-write]').evaluateAll((fs) => fs.filter((f) => !f.closest('dialog')).length), 0, `${path}: no create form is drawn on the page`)
}

eachBrowser((name, launch) => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`New and C open every collection's create form in the dialog, and Cancel, Escape and a click outside close it, writing nothing, in ${scheme}`, async (t) => {
      const browser = await launch()
      const dev = await serve()
      let seen = 0
      try {
        const ctx = await context(browser, scheme)
        await signIn(ctx, dev.base, camille)
        const paths = await collections(ctx, dev.base)
        const page = await ctx.newPage()
        for (const path of paths) {
          await visit(page, dev.base, path)
          // A collection's New, not the arranger's New group or accordion on Features.
          const create = page.getByRole('button', { name: /^New(?! (accordion|group))/ })
          if (!(await create.count())) {
            continue
          }
          seen++
          const before = await count(page)
          await create.first().click()
          await opened(page, path, 'New')
          await dialog(page).getByRole('button', { name: 'Cancel' }).first().click()
          await closed(page, 'Cancel', path)

          // The focus is back on New, which takes no key of its own.
          await page.keyboard.press('c')
          await opened(page, path, 'C')
          await page.keyboard.press('Escape')
          await closed(page, 'Escape', path)

          await create.first().click()
          await opened(page, path, 'New')
          await page.mouse.click(4, 4)
          await closed(page, 'a click outside', path)
          assert.equal(await count(page), before, `${path}: closing New writes nothing`)
        }
      } finally {
        await browser.close()
        await dev.stop()
      }
      t.diagnostic(`opened New on ${seen} collections`)
      assert.ok(seen > 10, 'New is opened on most collections')
    })

    it(`a create from New settles and closes it, the row among the rows; a refusal stays inside it with its reason and what was typed, in ${scheme}`, async () => {
      const browser = await launch()
      const dev = await serve()
      try {
        const made = await context(browser, scheme)
        await signIn(made, dev.base, thomas)
        const page = await made.newPage()
        await visit(page, dev.base, '/tasks')
        await page.getByRole('button', { name: /^New/ }).click()
        const form = dialog(page).locator('form')
        const title = `From New's dialog in ${name}, ${scheme}`
        await form.getByLabel('Title').fill(title)
        await form.getByRole('button', { name: 'Create task' }).click()
        await closed(page, 'a settled create', '/tasks')
        await page.locator('main .rows').getByText(title, { exact: true }).waitFor({ timeout: 10000 })

        const refused = await context(browser, scheme)
        await signIn(refused, dev.base, sofia)
        const bills = await refused.newPage()
        await visit(bills, dev.base, '/bills')
        const before = await count(bills)
        await bills.keyboard.press('c')
        const bill = dialog(bills).locator('form')
        await bill.getByLabel('Supplier').fill('Imprimerie du Parc')
        await bill.getByLabel('Their reference').fill(`FA-NEW-${name}-${scheme}`)
        await bill.getByLabel('What for').fill('Proofs')
        await bill.getByLabel('Line 1').fill('Proofs')
        await bill.getByLabel('Unit price, €').fill('120.00')
        await bill.getByRole('button', { name: 'Record bill' }).click()
        const reason = dialog(bills).getByRole('alert')
        await reason.waitFor({ timeout: 10000 })
        assert.match((await reason.textContent()) ?? '', /no mandate for record-bill/, 'the guard says why inside the dialog')
        assert.equal(await bill.getByLabel('Supplier').inputValue(), 'Imprimerie du Parc', 'what was typed stays')
        await dialog(bills).getByRole('button', { name: 'Cancel' }).click()
        await closed(bills, 'Cancel', '/bills')
        assert.equal(await count(bills), before, 'the refused bill is no row')
      } finally {
        await browser.close()
        await dev.stop()
      }
    })
  }
})
