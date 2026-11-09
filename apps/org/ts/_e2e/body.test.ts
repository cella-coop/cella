// A task's body, in every browser, on a seeded Lanterne through the dev
// server: Léa and Thomas, who sit in Web, open one of Web's tasks in two
// tabs, each their own device, and its main area opens on core body's
// editor over the task's live session. What one types the other sees; at
// a pause each browser saves through `task:body:save`, signed by its
// device, and the entry names who contributed; a reload opens on the
// save. Camille, whose seats are in Brand and Coordination, opens it on
// the save and may edit it too, since Lanterne's participants discuss in
// every circle, by a mandate with no scope; a reader who may not discuss
// the body is core body's session tests' to prove. Each browser edits a
// task of its own, so they meet in nothing they write. Screenshots light
// and dark go to `SHOTS`. Run by `cella test e2e body`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-body-shots'
const lea = 'lea@lanterne.example'
const thomas = 'thomas@lanterne.example'
const camille = 'camille@lanterne.example'
const tasks: Record<string, string> = { chromium: 't-4', firefox: 't-5', webkit: 't-6' }

const body = (page: Page) => page.locator('[data-body]')
const editor = (page: Page) => page.locator('[data-editor]')

// Waits until the body's text, as a tab shows it, holds every one of
// `texts`, as edits travel.
async function shows(page: Page, texts: string[], what: string) {
  for (let i = 0; i < 100; i++) {
    const t = (await page.locator('main [role=document]').first().textContent()) ?? ''
    if (texts.every((x) => t.includes(x))) {
      return
    }
    await page.waitForTimeout(100)
  }
  assert.fail(`${what}: never showed ${JSON.stringify(texts)}: ${await page.locator('main [role=document]').first().textContent()}`)
}

// Waits until the tab says its edits are saved.
const saved = (page: Page) => page.waitForSelector('[data-body=edit][data-state=saved]', { timeout: 20_000 })

eachBrowser((name, launch) => {
  test(`${name}: two members edit a task's body live, each browser saves it signed, a reload opens on the save, and a member seated elsewhere opens it on the save`, async () => {
    mkdirSync(shots, { recursive: true })
    const task = tasks[name]
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    const contexts: BrowserContext[] = []
    const open = async (actor: string, scheme: 'light' | 'dark') => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(context)
      await signIn(context, base, actor)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${actor}: ${e.message}`))
      await page.goto(`${base}/tasks/${task}`)
      await body(page).waitFor()
      return page
    }
    try {
      const a = await open(lea, 'light')
      const b = await open(thomas, 'light')
      for (const [who, page] of [['Léa', a], ['Thomas', b]] as const) {
        await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
        assert.equal(await editor(page).count(), 1, `${name}: ${who}'s main area opens on the editor`)
      }

      const first = `Léa's notes in ${name}`
      await editor(a).locator('[contenteditable=true]').first().click()
      await a.keyboard.type(first)
      await shows(b, [first], `${name}: Thomas's tab`)

      const second = `Thomas adds a line in ${name}`
      await editor(b).locator('[contenteditable=true]').last().click()
      await b.keyboard.press('End')
      await b.keyboard.press('Enter')
      await b.keyboard.type(second)
      await shows(a, [first, second], `${name}: Léa's tab`)

      await saved(a)
      await saved(b)
      const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
      assert.match(row.rows[0]?.text ?? '', new RegExp(`${first}[\\s\\S]*${second}`), `${name}: the task's column holds both members' edits`)
      const entries = await su.query<{ actor: string; contributors: string[] }>(
        `SELECT actor, cella.opened(n) -> 'contributors' AS contributors FROM cella.log
         WHERE op = 'task:body:save' AND cella.opened(n) ->> 'task' = $1 ORDER BY n`,
        [task],
      )
      assert.ok(entries.rows.length >= 1, `${name}: the body was saved by task:body:save`)
      assert.ok(entries.rows.every((e) => [lea, thomas].includes(e.actor)), `${name}: each save is signed by an editor's device`)
      assert.deepEqual([...new Set(entries.rows.flatMap((e) => e.contributors))].sort(), [lea, thomas], `${name}: the saves name both contributors`)
      await a.screenshot({ path: `${shots}/body-${name}-light.png`, fullPage: true })

      await a.reload()
      await a.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(a, [first, second], `${name}: Léa's tab after a reload`)

      // Lanterne's participants discuss in every circle, by a mandate with
      // no scope, so Camille, whose seats are in Brand and Coordination,
      // edits Web's task too, on the save as it stands.
      const c = await open(camille, 'dark')
      await c.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(c, [first, second], `${name}: Camille's tab`)
      await c.screenshot({ path: `${shots}/body-${name}-dark.png`, fullPage: true })

      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      for (const context of contexts) {
        await context.close()
      }
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
