// The favorites scenario, in every browser, on a seeded Lanterne through
// the dev server: Inès, in Web and no member, reads the tasks of Web and
// of the assembly and of no other circle. In Web, the tasks are Web's
// own; she chooses Every circle in the View panel and saves the view,
// which reads the rows of both circles she reads and none of the
// others', and counts them so on its tab. She pins it and the tasks'
// All to Favorites, and finds both in the sidebar from every circle she
// reads and after a reload, the view across circles opening on the rows
// of both from any of them. `SHOTS` names where its screenshots go. It
// writes nothing to the log. Run by `cella test e2e favorites`.
// covers: task

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()

const shots = process.env.SHOTS ?? '/tmp/cella-favorites-shots'
const ines = 'ines@lanterne.example'
const name = 'Tasks across circles'

// The circles of the tasks the page lists, by each task's owning circle,
// once its rows are drawn and no navigation dims them.
async function listed(page: Page, owner: Map<string, string>): Promise<string[]> {
  await page.locator('main a[href^="/tasks/"]').first().waitFor()
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'))
  const ids = await page.locator('main a[href^="/tasks/"]').evaluateAll((as) => as.map((a) => decodeURIComponent(a.getAttribute('href')!.split('/')[2]!.split(/[?#]/)[0]!)))
  assert.ok(ids.length > 0, 'the page lists tasks')
  return [...new Set(ids.map((id) => owner.get(id) ?? `unknown ${id}`))].sort()
}

// The Favorites the sidebar lists, each its name and address.
const favorites = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Main' })
    .locator('.favorites a')
    .evaluateAll((as) => as.map((a) => ({ name: a.textContent?.trim() ?? '', href: a.getAttribute('href') ?? '' })))

before(async () => {
  await su.connect()
})

after(async () => {
  await su.end()
})

eachBrowser((engine, launch) => {
  test(`${engine}: a view across circles reads every circle Inès reads, and Favorites pin it and All the same in every circle`, async () => {
    mkdirSync(shots, { recursive: true })
    const owner = new Map((await su.query<{ id: string; circle: string }>(`SELECT id::text, circle FROM task.task`)).rows.map((r) => [r.id, r.circle]))
    const holding = [...new Set(owner.values())].sort()
    const assembly = (await su.query<{ id: string }>(`SELECT id FROM circle.circle WHERE assembly`)).rows[0]!.id
    const reads = [assembly, 'web'].sort()
    assert.ok(holding.some((c) => !reads.includes(c)), 'some circle Inès does not read holds tasks')
    const browser = await launch()
    const dev = await serve()
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      await signIn(context, dev.base, ines)
      await context.addCookies([{ name: 'cella-lens', value: 'web', url: dev.base }])
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
      await page.goto(`${dev.base}/tasks`)
      await page.waitForLoadState('networkidle')
      const nav = page.getByRole('navigation', { name: 'Main' })
      assert.deepEqual(await listed(page, owner), ['web'], `${engine}: in Web the tasks are Web's own`)
      assert.deepEqual(await favorites(page), [], `${engine}: nothing is pinned yet`)
      assert.equal(await nav.locator('.favorites .hint').count(), 1, `${engine}: Favorites say where a view is pinned from`)

      // Every circle, saved as her own view.
      const circles = page.getByRole('combobox', { name: 'Circles' })
      assert.equal(await circles.inputValue(), 'this', `${engine}: the view reads this circle`)
      await circles.selectOption('every')
      await page.waitForURL(/[?&]across=1/)
      await page.waitForLoadState('networkidle')
      await page.getByText("Across circles: every circle's tasks you read.").waitFor()
      assert.deepEqual(await listed(page, owner), reads, `${engine}: across circles, the tasks of both circles she reads and none of another's`)
      await page.getByRole('button', { name: 'Save as view' }).click()
      await page.getByRole('textbox', { name: 'View name' }).fill(name)
      await page.getByRole('button', { name: 'Save view' }).click()
      await page.waitForURL(/[?&]v=c-/)
      await page.waitForLoadState('networkidle')
      const tab = page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name })
      await page.waitForFunction((n) => [...document.querySelectorAll('nav[aria-label="Views"] a')].some((a) => a.textContent?.trim() === n && /\d/.test(a.getAttribute('title') ?? '')), name)
      const across = [...owner.values()].filter((c) => reads.includes(c)).length
      assert.equal(await tab.getAttribute('title'), `View ${name} tasks ${across}`, `${engine}: its tab counts the tasks of both circles`)
      assert.deepEqual(await listed(page, owner), reads, `${engine}: the saved view reads across circles`)

      // Pinned, then the tasks' All.
      await page.getByRole('button', { name: 'Pin to Favorites' }).click()
      await page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: 'All' }).click()
      await page.waitForURL((u) => !u.searchParams.has('v'))
      await page.waitForLoadState('networkidle')
      assert.deepEqual(await listed(page, owner), ['web'], `${engine}: All reads Web's tasks`)
      await page.getByRole('button', { name: 'Pin to Favorites' }).click()
      await page.waitForFunction(() => document.querySelectorAll('.favorites a').length === 2)
      const pinned = await favorites(page)
      assert.deepEqual(pinned.map((f) => f.name), [name, 'Tasks'], `${engine}: both pinned, in the order she pinned them`)
      assert.match(pinned[0]!.href, /^\/tasks\?v=c-[\w-]+&.*across=1/, `${engine}: the view across circles opens at its own address`)
      assert.equal(await page.getByRole('button', { name: 'Unpin from Favorites' }).count(), 1, `${engine}: All reads as pinned`)
      await page.screenshot({ path: `${shots}/favorites-web-${engine}.png` })

      // The same in every circle she reads, and after a reload.
      for (const lens of ['', 'web']) {
        await context.addCookies([{ name: 'cella-lens', value: lens, url: dev.base }])
        await page.goto(`${dev.base}/inbox`)
        await page.waitForLoadState('networkidle')
        assert.deepEqual(await favorites(page), pinned, `${engine}: in ${lens || 'the assembly'}, the same Favorites`)
        await page.reload()
        await page.waitForLoadState('networkidle')
        assert.deepEqual(await favorites(page), pinned, `${engine}: in ${lens || 'the assembly'}, after a reload, the same Favorites`)
        await nav.locator('.favorites').getByRole('link', { name, exact: true }).click()
        await page.waitForURL(/[?&]v=c-/)
        await page.waitForLoadState('networkidle')
        assert.deepEqual(await listed(page, owner), reads, `${engine}: from ${lens || 'the assembly'}, the view across circles reads both circles' tasks`)
        assert.equal(await nav.locator('.favorites a[aria-current="page"]').textContent().then((t) => t?.trim()), name, `${engine}: Favorites mark the view open`)
        await nav.locator('.favorites').getByRole('link', { name: 'Tasks', exact: true }).click()
        await page.waitForURL((u) => u.pathname === '/tasks' && !u.searchParams.has('v'))
        await page.waitForLoadState('networkidle')
        assert.deepEqual(await listed(page, owner), lens ? ['web'] : reads, `${engine}: from ${lens || 'the assembly'}, All reads the circle she is in`)
      }
      await page.screenshot({ path: `${shots}/favorites-assembly-${engine}.png` })

      // Renamed, its pin follows; deleted, it goes.
      await nav.locator('.favorites').getByRole('link', { name, exact: true }).click()
      await page.waitForURL(/[?&]v=c-/)
      await page.waitForLoadState('networkidle')
      const naming = page.locator('.saving').getByRole('textbox', { name: 'View name' })
      await naming.fill('Our tasks')
      await naming.press('Enter')
      await naming.blur()
      await page.waitForFunction(() => [...document.querySelectorAll('.favorites a')].some((a) => a.textContent?.trim() === 'Our tasks'))
      page.once('dialog', (d) => void d.accept())
      await page.getByRole('button', { name: 'Delete view' }).click()
      await page.waitForFunction(() => document.querySelectorAll('.favorites a').length === 1)
      assert.deepEqual((await favorites(page)).map((f) => f.name), ['Tasks'], `${engine}: the deleted view's pin goes with it`)
      assert.deepEqual(errors, [], `${engine}: the pages threw nothing`)
    } finally {
      await context.close()
      await dev.stop()
      await browser.close()
    }
  })
})
