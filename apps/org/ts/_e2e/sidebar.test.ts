// The sidebar scenario, in every browser, light and dark, on a seeded
// Lanterne through the dev server: Camille signs in and lands in the
// assembly, first in the co-op selector, its features in the sidebar
// under its accordions and nothing else of the co-op's collections but
// the Inbox and Activity. Each of Lanterne's circles, chosen, shows its
// own enabled features in its order and under its accordions. She
// chooses Web from the selector: its features, flat, and its rows; More…
// opens Web's features page. `SHOTS` names where its screenshots go. It
// writes nothing to the log. Run by `cella test e2e sidebar`.
// covers: all

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()

const shots = process.env.SHOTS ?? '/tmp/cella-sidebar-shots'
const camille = 'camille@lanterne.example'

// Where each feature Lanterne's circles enable shows in the sidebar: the
// collections its feat owns that the sidebar lists, in its order; none
// for a feature that owns none, as membership, or whose only one is
// Settings' or unlisted, as imports and files.
const collections: Record<string, string[]> = {
  motion: ['/motions'],
  policy: [],
  document: ['/documents'],
  meeting: ['/meetings'],
  membership: [],
  patronage: ['/distributions', '/bases', '/statements'],
  person: ['/people'],
  circle: ['/circles', '/mandates'],
  project: ['/projects'],
  task: ['/tasks'],
  timesheet: ['/timesheets'],
  file: [],
  contact: ['/contacts'],
  bill: ['/bills'],
  invoice: ['/invoices'],
  expense: ['/expenses'],
  payslip: ['/payslips'],
  account: ['/accounts', '/periods', '/terms'],
  transaction: ['/transactions'],
  report: ['/reports'],
  import: [],
  employment: [],
}

// A circle's features as the sidebar should draw them, from its listing:
// each run an accordion's name, or none, and its collections.
function expected(listing: string): string[] {
  return listing
    .split(';')
    .filter((run) => run.trim())
    .flatMap((run) => {
      const colon = run.indexOf(':')
      const hrefs = (colon >= 0 ? run.slice(colon + 1) : run).split(',').flatMap((f) => {
        const known = collections[f.trim()]
        assert.ok(known, `the scenario knows where ${f.trim()} shows`)
        return known
      })
      return colon >= 0 && hrefs.length ? [`[${run.slice(0, colon).trim()}]`, ...hrefs] : hrefs
    })
}

// The sidebar's middle as drawn, every accordion opened: each accordion's
// name in brackets, then its collections; a collection under none as it
// stands; and More…'s address.
async function drawn(page: Page): Promise<{ middle: string[]; more: string | null }> {
  const middle = page.getByRole('navigation', { name: 'Main' }).locator('.middle')
  const shut = middle.locator('button.head[aria-expanded="false"]')
  for (let left = 20; left > 0 && (await shut.count()) > 0; left--) {
    await shut.first().click()
  }
  const items = await middle.locator('button.head, ul a').evaluateAll((els) =>
    els.map((e) => (e.tagName === 'BUTTON' ? `[${e.querySelector('.title')?.textContent?.trim()}]` : e.getAttribute('href')!)),
  )
  return { middle: items, more: await middle.getByRole('link', { name: 'More…' }).getAttribute('href') }
}

before(async () => {
  await su.connect()
})

after(async () => {
  await su.end()
})

eachBrowser((name, launch) => {
  test(`${name}: the sidebar shows the circle Camille is in, the assembly first and where she lands, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const circles = (await su.query<{ id: string; name: string; assembly: boolean; features: string }>(
      `SELECT id, name, assembly, circle.features(id) AS features FROM circle.circle ORDER BY NOT assembly, name`,
    )).rows
    const assembly = circles.find((c) => c.assembly)!
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        const dev = await serve()
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          // A lens left from before is cleared by the sign-in.
          await context.addCookies([{ name: 'cella-lens', value: 'web', url: dev.base }])
          await signIn(context, dev.base, camille)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
          await page.goto(`${dev.base}/inbox`)
          await page.waitForLoadState('networkidle')
          const nav = page.getByRole('navigation', { name: 'Main' })
          const trigger = nav.locator('.coop .trigger')
          const named = async () => ((await nav.locator('.coop .name').textContent()) ?? '').replace(/\s*\/\s*/, ' / ').replace(/\s+/g, ' ').trim()

          // The assembly: where she lands, first in the selector and checked.
          assert.equal(await named(), 'Lanterne', `${at}: she lands in the assembly, the trigger naming the co-op alone`)
          const top = await nav.locator('.top > ul a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
          assert.deepEqual(top, ['/inbox', '/log'], `${at}: the Inbox and Activity always stand above the features`)
          const { middle, more } = await drawn(page)
          assert.deepEqual(middle, expected(assembly.features), `${at}: the assembly's features, in its order, under its accordions`)
          assert.deepEqual(middle.slice(0, 1), ['[Governance]'], `${at}: its first accordion is Governance`)
          assert.ok(!middle.includes('/tasks') && !middle.includes('/accounts'), `${at}: nothing the assembly has not enabled`)
          assert.equal(more, `/settings/features/${assembly.id}`, `${at}: More… opens the assembly's features page`)
          await page.screenshot({ path: `${shots}/sidebar-assembly-${name}-${scheme}.png` })
          await trigger.click()
          const menu = page.getByRole('group', { name: 'Circles' })
          const rows = await menu.getByRole('menuitemradio').evaluateAll((bs) => bs.map((b) => `${b.textContent?.trim()}${b.getAttribute('aria-checked') === 'true' ? ' ✓' : ''}`))
          assert.equal(rows[0], `${assembly.name} ✓`, `${at}: the assembly is first in the selector, and checked`)
          assert.ok(!rows.some((r) => /All circles/.test(r)), `${at}: no row lists all circles`)
          assert.equal(rows.length, circles.length, `${at}: every circle she reads is offered`)
          await page.screenshot({ path: `${shots}/sidebar-selector-${name}-${scheme}.png` })
          await page.keyboard.press('Escape')

          // Each circle, chosen, shows its own enabled features.
          for (const c of circles.filter((c) => !c.assembly)) {
            await context.addCookies([{ name: 'cella-lens', value: c.id, url: dev.base }])
            await page.goto(`${dev.base}/inbox`)
            await page.waitForLoadState('networkidle')
            assert.equal(await named(), `Lanterne / ${c.name}`, `${at}: the trigger names ${c.name}`)
            const shown = await drawn(page)
            assert.deepEqual(shown.middle, expected(c.features), `${at}: ${c.name}'s features, in its order, under its accordions`)
            assert.equal(shown.more, `/settings/features/${c.id}`, `${at}: More… opens ${c.name}'s features page`)
          }

          // Back to the assembly by the selector, then Web.
          await trigger.click()
          await page.getByRole('menuitemradio', { name: assembly.name }).click()
          await page.waitForFunction(() => !document.querySelector('.coop .name')?.textContent?.includes('/'))
          await page.waitForLoadState('networkidle')
          assert.equal(await named(), 'Lanterne', `${at}: the assembly's row clears the lens`)
          await page.goto(`${dev.base}/tasks`)
          await page.waitForLoadState('networkidle')
          await trigger.click()
          await page.getByRole('menuitemradio', { name: 'Web' }).click()
          await page.waitForFunction(() => document.querySelector('.coop .name')?.textContent?.includes('Web'))
          assert.equal(new URL(page.url()).pathname, '/tasks', `${at}: the selector returns to the page she chose on`)
          await page.waitForLoadState('networkidle')
          assert.equal(await named(), 'Lanterne / Web', `${at}: choosing Web puts her in Web`)
          const web = circles.find((c) => c.id === 'web')!
          assert.deepEqual((await drawn(page)).middle, expected(web.features), `${at}: Web's features, flat, in its order`)
          assert.equal(await nav.locator('button.head').count(), 0, `${at}: Web names no accordion`)
          assert.equal(await nav.locator('a[aria-current="page"]').getAttribute('href'), '/tasks', `${at}: the sidebar marks Tasks`)
          const owned = new Set((await su.query<{ id: string }>(`SELECT id::text FROM task.task WHERE circle = 'web'`)).rows.map((r) => r.id))
          const listed = await page.locator('main a[href^="/tasks/"]').evaluateAll((as) => as.map((a) => decodeURIComponent(a.getAttribute('href')!.split('/')[2]!.split(/[?#]/)[0]!)))
          assert.ok(listed.length > 0 && listed.every((id) => owned.has(id)), `${at}: the tasks are Web's own, ${listed.length} of them`)
          await page.screenshot({ path: `${shots}/sidebar-web-${name}-${scheme}.png` })

          await nav.getByRole('link', { name: 'More…' }).click()
          await page.waitForURL(`${dev.base}/settings/features/web`)
          await page.waitForLoadState('networkidle')
          assert.equal(await page.getByRole('link', { name: 'Back to app' }).count(), 1, `${at}: More… opens Web's features page in Settings`)
          assert.deepEqual(errors, [], `${at}: the pages threw nothing`)
        } finally {
          await context.close()
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})
