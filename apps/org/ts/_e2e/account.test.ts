// The account scenario, in every browser, light and dark, on a seeded
// Lanterne through the dev server: Camille opens Settings from the
// account menu and lands on her Account, `/settings/account`, first
// under Personal: her name, email and phone, her theme, and her devices,
// the one she signs with marked as this device. She changes her name
// and her theme in one Save; the name settles by `profile`, signed by
// her device, the page wears the theme at once, and after a reload both
// stand, the sidebar's account naming her by the new name. No field of
// hers opens a motion. `SHOTS` names where its screenshots go. Run by
// `cella test e2e account`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { browsers, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-account-shots'
const camille = 'camille@lanterne.example'

for (const [name, launch] of browsers()) {
  test(`${name}: Camille changes her name and theme from her Account settings, and both stand after a reload, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        const renamed = `Camille Martin (${name}, ${scheme})`
        const other = scheme === 'light' ? 'dark' : 'light'
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${base}/inbox`)
        await page.waitForLoadState('networkidle')

        const nav = page.getByRole('navigation', { name: 'Main' })
        const account = nav.locator('.account')
        await account.getByRole('button').first().click()
        await account.getByRole('menuitem', { name: 'Settings' }).click()
        await page.waitForURL(`${base}/settings/account`)
        await page.waitForLoadState('networkidle')
        assert.deepEqual(
          (await nav.locator('ul').first().locator('a').allTextContents()).map((t) => t.trim()),
          ['Account', 'Devices'],
          `${at}: Account is Personal's first page`,
        )
        assert.equal(await nav.locator('a[aria-current="page"]').textContent().then((t) => t?.trim()), 'Account', `${at}: the sidebar marks it`)

        const form = page.locator('form.settings')
        const was = await form.getByLabel('Name').inputValue()
        assert.match(was, /^Camille/, `${at}: her name in force`)
        assert.equal(await form.getByLabel('Theme').inputValue(), 'system', `${at}: the system's theme, as no cookie says otherwise`)
        assert.doesNotMatch((await form.textContent()) ?? '', /A motion of/, `${at}: no field of hers opens a motion`)
        const devices = page.locator('section', { has: page.getByRole('heading', { name: 'Devices' }) })
        assert.match((await devices.textContent()) ?? '', /, this device/, `${at}: the device she signs with is marked`)
        await page.screenshot({ path: `${shots}/account-${name}-${scheme}.png`, fullPage: true })

        await form.getByLabel('Name').fill(renamed)
        await form.getByLabel('Theme').selectOption(other)
        await form.getByRole('button', { name: 'Save' }).click()
        await page.waitForFunction((t) => document.documentElement.dataset.theme === t, other)
        await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
        assert.equal(await form.getByLabel('Name').inputValue(), renamed, `${at}: the field shows the name saved`)
        assert.doesNotMatch((await form.textContent()) ?? '', /Not saved/, `${at}: every field saved`)
        const row = await su.query<{ name: string }>('SELECT name FROM person.person WHERE address = $1', [camille])
        assert.equal(row.rows[0]?.name, renamed, `${at}: the profile write settled`)
        await page.screenshot({ path: `${shots}/account-saved-${name}-${scheme}.png`, fullPage: true })

        await page.reload()
        await page.waitForLoadState('networkidle')
        assert.equal(await page.locator('html').getAttribute('data-theme'), other, `${at}: the theme stands after a reload`)
        assert.equal(await form.getByLabel('Theme').inputValue(), other)
        assert.equal(await form.getByLabel('Name').inputValue(), renamed, `${at}: the name stands after a reload`)
        assert.match((await account.textContent()) ?? '', new RegExp(renamed.replace(/[()]/g, '\\$&')), `${at}: the account menu names her by it`)
        assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        await context.close()
      }
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
}
