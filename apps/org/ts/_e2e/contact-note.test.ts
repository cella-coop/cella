// The contact note scenario, in every browser, on a seeded Lanterne
// through the dev server: Camille opens a client's page, whose Note has
// no Save note and no Save button at all; she types a note and leaves the
// field, clicking past it, and it settles by `update`, the note alone,
// saying it saved; after a reload the note stands. Each browser writes
// the note of a contact of its own, so they never meet. `SHOTS` names
// where its screenshots go. Run by `cella test e2e contact-note`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-contact-note-shots'
const camille = 'camille@lanterne.example'
const contacts: Record<string, string> = { chromium: 'velo', firefox: 'ondine', webkit: 'ferrand' }

eachBrowser((name, launch) => {
  test(`${name}: Camille types a contact's note and leaves it, and it stands after a reload, with no Save button`, async () => {
    mkdirSync(shots, { recursive: true })
    const id = contacts[name]
    const noted = `Prefers a call on Tuesdays (${name})`
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/contacts/${id}`)
      await page.waitForLoadState('networkidle')

      const section = page.locator('section', { has: page.getByRole('heading', { name: 'Note', exact: true }) })
      const field = section.getByLabel('Note')
      await field.waitFor()
      assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${name}: the page has no Save button`)

      await field.fill(noted)
      await section.getByRole('heading', { name: 'Note', exact: true }).click()
      await page.getByRole('status').filter({ hasText: /Settled/ }).waitFor()
      await section.getByText('Saved', { exact: true }).waitFor()
      assert.doesNotMatch((await section.textContent()) ?? '', /Not saved/, `${name}: the note saved`)
      const row = await su.query<{ note: string }>('SELECT note FROM contact.contact WHERE id = $1', [id])
      assert.equal(row.rows[0]?.note, noted, `${name}: the update settled`)
      await page.screenshot({ path: `${shots}/contact-note-${name}.png`, fullPage: true })

      await page.reload()
      await page.waitForLoadState('networkidle')
      assert.equal(await section.getByLabel('Note').inputValue(), noted, `${name}: the note stands after a reload`)
      assert.deepEqual(errors, [], `${name}: the page threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
