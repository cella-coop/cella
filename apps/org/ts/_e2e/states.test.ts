// The states specimen (`/specimens/states`), in every browser, light and
// dark: a state draws one look, a pill with a dot, including the one the
// kit gains here, Failed; Panel, Section and the drawer's Card all draw
// it from the same heading. `SHOTS` names where its screenshots go. Run
// by `cella test e2e states`.
// covers: core

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-states-shots'

eachBrowser((name, launch) => {
  test(`${name}: Panel, Section and Card share one heading, and a state is one pill with a dot, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 1400 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, 'camille@lanterne.example')
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${base}/specimens/states`)
        await page.waitForLoadState('networkidle')
        const at = `${name}, ${scheme}`

        const panel = page.getByRole('heading', { name: /^Import/ })
        const section = page.getByRole('heading', { name: /^Rows/ })
        const card = page.getByRole('heading', { name: /^Legend/ })
        await panel.waitFor()
        await section.waitFor()
        await card.waitFor()

        for (const heading of [panel, section, card]) {
          const row = heading.locator('..')
          await heading.scrollIntoViewIfNeeded()
          assert.ok(await row.getByText('Failed', { exact: true }).first().isVisible(), `${at}: its heading wears the Failed pill`)
        }

        // Every tone draws as a dot inside a pill, never an icon, inside
        // the Legend card's list.
        const pills = page.locator('.card li .badge')
        assert.equal(await pills.count(), 6, `${at}: the six tones, each one pill`)
        for (let i = 0; i < 6; i++) {
          assert.equal(await pills.nth(i).locator('.mark').count(), 0, `${at}: a state's pill carries no icon, only its dot`)
        }

        await page.screenshot({ path: `${shots}/states-${name}-${scheme}.png`, fullPage: true })
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
    }
  })
})
