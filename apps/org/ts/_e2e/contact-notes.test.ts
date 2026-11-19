// The contact notes scenario, in every browser, on a seeded Lanterne
// through the dev server: a contact's notes are its body, one place for
// them. Camille opens a client's page, which has no Note field and no
// Save button, only its Notes, the body the seed wrote. She types a line
// after it, and at a pause her browser saves it through
// `contact:body:save`, signed by her device, the entry naming her as its
// contributor; after a reload her line stands under the seed's. Lanterne's
// participants discuss in every circle, by a mandate with no scope, so
// she may; a reader who may not is core body's session tests' to prove.
// Each browser writes the notes of a contact of its own, so they never
// meet. `SHOTS` names where its screenshots go. Run by
// `cella test e2e contact-notes`.
// covers: contact

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-contact-notes-shots'
const camille = 'camille@lanterne.example'
const contacts: Record<string, string> = { chromium: 'velo', firefox: 'ondine', webkit: 'ferrand' }

const notes = (page: Page) => page.getByRole('complementary', { name: 'Notes', exact: true })

// Waits until the Notes show every one of `texts`, as the save and the
// reload bring them.
async function shows(page: Page, texts: string[], what: string) {
  for (let i = 0; i < 100; i++) {
    const t = (await notes(page).locator('[role=document]').first().textContent()) ?? ''
    if (texts.every((x) => t.includes(x))) {
      return
    }
    await page.waitForTimeout(100)
  }
  assert.fail(`${what}: never showed ${JSON.stringify(texts)}: ${await notes(page).locator('[role=document]').first().textContent()}`)
}

eachBrowser((name, launch) => {
  test(`${name}: Camille types into a contact's Notes, its body, and it is saved signed and stands after a reload`, async () => {
    mkdirSync(shots, { recursive: true })
    const id = contacts[name]
    const typed = `Prefers a call on Tuesdays (${name})`
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    try {
      const seeded = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM contact.contact WHERE id = $1', [id])
      const before = (seeded.rows[0]?.text ?? '').trim()
      assert.ok(before, `${name}: the seed wrote ${id}'s notes into its body`)
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/contacts/${id}`)
      await page.waitForLoadState('networkidle')

      await notes(page).locator('[data-body=edit]').waitFor({ timeout: 20_000 })
      assert.equal(await page.getByRole('complementary', { name: 'Note', exact: true }).count(), 0, `${name}: the page has no Note field of its own`)
      assert.equal(await page.getByRole('button', { name: /^Save/ }).count(), 0, `${name}: the page has no Save button`)
      await shows(page, [before], `${name}: the Notes`)

      await notes(page).locator('[data-editor] [contenteditable=true]').last().click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.type(typed)
      await page.waitForSelector('[data-body=edit][data-state=saved]', { timeout: 20_000 })

      const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM contact.contact WHERE id = $1', [id])
      assert.ok((row.rows[0]?.text ?? '').includes(before) && (row.rows[0]?.text ?? '').includes(typed), `${name}: the body holds the seed's notes and Camille's line`)
      const entries = await su.query<{ actor: string; contributors: string[] }>(
        `SELECT actor, cella.opened(n) -> 'contributors' AS contributors FROM cella.log
         WHERE op = 'contact:body:save' AND cella.opened(n) ->> 'contact' = $1 ORDER BY n`,
        [id],
      )
      assert.ok(entries.rows.length >= 1, `${name}: the notes were saved by contact:body:save`)
      assert.ok(entries.rows.every((e) => e.actor === camille), `${name}: each save is signed by Camille's device`)
      assert.deepEqual([...new Set(entries.rows.flatMap((e) => e.contributors))], [camille], `${name}: the saves name her as their contributor`)
      await page.screenshot({ path: `${shots}/contact-notes-${name}.png`, fullPage: true })

      await page.reload()
      await notes(page).locator('[data-body=edit]').waitFor({ timeout: 20_000 })
      await shows(page, [before, typed], `${name}: the Notes after a reload`)
      assert.deepEqual(errors, [], `${name}: the page threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
