// The accessibility scan, on a seeded Lanterne through the built shell:
// axe-core, through Playwright, reads the sign-in page and, signed in as
// Camille, the home, every collection the sidebar mounts in its default
// view, the first item each lists and its form open on New, in light and
// in dark, on each browser `BROWSERS` names. A violation of impact
// serious or critical fails it, unless `waiting` lists its rule on that
// page: what waits for the operator's design session, since its fix
// would change the design system's look. Run by `cella test e2e a11y`.

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from 'playwright-core'
import { browsers, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'

// What waits for the design session, by axe rule and the path of each
// page it is on; it only shrinks, and a rule's violation on a page it
// does not name still fails.
const waiting: Record<string, string[]> = {}

interface Found {
  rule: string
  impact: string
  page: string
  scheme: string
  targets: string[]
}

// The serious and critical violations axe finds on the page as it stands.
async function scan(page: Page, scheme: string): Promise<Found[]> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const path = new URL(page.url()).pathname
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({ rule: v.id, impact: v.impact!, page: path, scheme, targets: v.nodes.map((n) => n.target.join(' ')) }))
}

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

for (const [name, launch] of browsers()) {
  describe(name, () => {
    for (const scheme of ['light', 'dark'] as const) {
      it(`every page the shell mounts passes the scan, in ${scheme}`, async (t) => {
        const browser = await launch()
        const dev = await serve()
        const found: Found[] = []
        const seen = { collections: 0, items: 0, forms: 0 }
        try {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 960 },
            colorScheme: scheme,
            extraHTTPHeaders: { 'x-forwarded-proto': 'http' },
          })
          const page = await context.newPage()
          // The sign-in page as a scope's server serves it, then the rest
          // signed in through the dev server's.
          let base = shell.base
          const visit = async (path: string) => {
            await page.goto(`${base}${path}`)
            await page.waitForLoadState('networkidle')
          }

          await visit('/sign-in')
          found.push(...(await scan(page, scheme)))

          base = dev.base
          await signIn(context, base, camille)
          await visit('/')
          const collections = await page
            .getByRole('navigation', { name: 'Main' })
            .locator('a[href^="/"]')
            .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))].filter((h) => h !== '/'))
          assert.ok(collections.length > 10, `the sidebar mounts the collections: ${collections.join(' ')}`)
          seen.collections = collections.length
          found.push(...(await scan(page, scheme)))

          for (const path of collections) {
            await visit(path)
            found.push(...(await scan(page, scheme)))
            const item = await page
              .locator(`main a[href^="${path}/"]`)
              .first()
              .getAttribute('href', { timeout: 1000 })
              .catch(() => null)
            const create = page.getByRole('button', { name: /^New/ })
            if (await create.count()) {
              const forms = await page.locator('main form').count()
              await create.first().click()
              await page.waitForFunction((n) => document.querySelectorAll('main form').length > n, forms)
              seen.forms++
              found.push(...(await scan(page, scheme)))
            }
            if (item) {
              await visit(item.split('?')[0])
              seen.items++
              found.push(...(await scan(page, scheme)))
            }
          }
        } finally {
          await browser.close()
          await dev.stop()
        }
        t.diagnostic(`scanned ${seen.collections} collections, ${seen.items} items and ${seen.forms} New forms`)
        assert.ok(seen.items > 10 && seen.forms > 10, 'an item and a New form are scanned on most collections')
        const failing = found.filter((f) => !waiting[f.rule]?.includes(f.page))
        assert.deepEqual(
          failing.map((f) => `${f.rule} (${f.impact}) on ${f.page}, ${f.scheme}: ${f.targets.slice(0, 3).join(', ')}`),
          [],
        )
      })
    }
  })
}
