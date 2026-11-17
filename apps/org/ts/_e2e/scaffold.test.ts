// A project's body and threads, as `cella scaffold body project` and
// `cella scaffold comments project` wrote them, in Chromium, on a seeded
// Lanterne through the dev server: Léa and Thomas, who sit in Web, open
// the Halles shop, and its Overview opens on core body's editor over the
// project's live session. What Léa types Thomas sees, and each browser
// saves it through `project:body:save`, signed by its device. Léa then
// posts under its Activity, mentioning Thomas through the picker; the
// mention waits in his Inbox until he replies to her root, and Léa
// resolves the thread, which folds the reply away. The task's own
// scenarios, `body` and `thread`, walk the rest in every browser.
// Screenshots go to `SHOTS`. Run by `cella test e2e scaffold`.
// covers: project

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-scaffold-shots'
const lea = 'lea@lanterne.example'
const thomas = 'thomas@lanterne.example'
const project = 'halles-shop'
const title = 'Les Halles Paysannes, online shop'

const editor = (page: Page) => page.locator('[data-editor]')
const box = (page: Page) => page.locator('[data-box]')
const threads = (page: Page) => page.locator('[data-thread]')

async function shows(page: Page, text: string, what: string, yes = true, where = 'main') {
  for (let i = 0; i < 100; i++) {
    const t = (await page.locator(where).first().textContent()) ?? ''
    if (t.includes(text) === yes) {
      return
    }
    await page.waitForTimeout(100)
  }
  assert.fail(`${what}: ${yes ? 'never showed' : 'still shows'} ${JSON.stringify(text)}`)
}

eachBrowser((name, launch) => {
  if (name !== 'chromium') {
    return
  }
  test(`${name}: a scaffolded project's body is edited live and saved signed, and its thread's mention waits in the Inbox until answered, then resolves`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    const contexts: BrowserContext[] = []
    const visit = async (context: BrowserContext, actor: string, path: string) => {
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${actor}: ${e.message}`))
      await page.goto(`${base}${path}`)
      if (path.startsWith('/projects/')) {
        await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      }
      return page
    }
    const open = async (actor: string, path: string) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(context)
      await signIn(context, base, actor)
      return visit(context, actor, path)
    }
    try {
      const a = await open(lea, `/projects/${project}`)
      const b = await open(thomas, `/projects/${project}`)
      assert.equal(await editor(a).count(), 1, `${name}: the project's Overview opens on the editor`)
      const words = 'Launch the shop before the Christmas market'
      await editor(a).locator('[contenteditable=true]').first().click()
      await a.keyboard.type(words)
      await shows(b, words, `${name}: Thomas's tab`, true, 'main [role=document]')
      await a.waitForSelector('[data-body=edit][data-state=saved]', { timeout: 20_000 })
      const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM project.project WHERE id = $1', [project])
      assert.match(row.rows[0]?.text ?? '', new RegExp(words), `${name}: the project's column holds Léa's edit`)
      const saves = await su.query<{ actor: string }>(`SELECT actor FROM cella.log WHERE op = 'project:body:save' AND cella.opened(n) ->> 'project' = $1`, [project])
      assert.ok(saves.rows.length >= 1 && saves.rows.every((e) => [lea, thomas].includes(e.actor)), `${name}: each save is signed by an editor's device`)

      const field = box(a).locator('[data-rich]')
      await field.click()
      await a.keyboard.type('Can you take the payment page, @Tho')
      await box(a).locator('[data-picker] button', { hasText: 'Thomas Nguyen' }).click()
      await a.keyboard.type('this week?')
      await box(a).getByRole('button', { name: 'Comment' }).click()
      await threads(a).first().waitFor({ timeout: 20_000 })
      await shows(a, '@Thomas Nguyen', `${name}: Léa's thread draws the mention by name`)
      const root = await su.query<{ id: string; text: string }>('SELECT id, text FROM project.comment WHERE project = $1 AND author = $2', [project, lea])
      assert.equal(root.rows[0]?.text, `Can you take the payment page, @[${thomas}] this week?`, `${name}: the text holds the mention by address`)
      await a.screenshot({ path: `${shots}/scaffold-${name}-body.png`, fullPage: true })

      const inbox = await visit(b.context(), thomas, '/inbox')
      await shows(inbox, `Léa Bernard mentioned you on ${title}`, `${name}: Thomas's Inbox`)
      const b2 = await visit(b.context(), thomas, `/projects/${project}`)
      await threads(b2).first().locator('[data-comment]').first().getByRole('button', { name: 'Reply' }).click()
      await b2.keyboard.type('Yes, by Friday.')
      await threads(b2).first().locator('[data-box-field]').getByRole('button', { name: 'Reply' }).click()
      await shows(b2, 'Yes, by Friday.', `${name}: Thomas's reply`)
      const after = await visit(b.context(), thomas, '/inbox')
      await shows(after, `Léa Bernard mentioned you on ${title}`, `${name}: Thomas's Inbox after his reply`, false)

      const a2 = await visit(a.context(), lea, `/projects/${project}`)
      await threads(a2).first().getByRole('button', { name: 'Resolve' }).click()
      await a2.waitForSelector('[data-thread]:not([data-resolved=""])', { timeout: 20_000 })
      await shows(a2, 'Resolved on', `${name}: the resolved thread folds to its line`)
      const logged = await su.query<{ op: string }>(`SELECT DISTINCT op FROM cella.log WHERE op LIKE 'project:comment:%' ORDER BY op`)
      assert.deepEqual(logged.rows.map((r) => r.op), ['project:comment:post', 'project:comment:resolve'], `${name}: the thread's writes are logged as the project's`)
      await a2.screenshot({ path: `${shots}/scaffold-${name}-thread.png`, fullPage: true })

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
