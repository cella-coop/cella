// A task's threads, in every browser, on a seeded Lanterne through the
// dev server: Léa posts on a task of Web's, mentioning Thomas through the
// picker, and the mention waits in Thomas's Inbox; Thomas replies to her
// root and it leaves; Léa resolves the thread, which folds the reply
// away. A reply to the reply, posted through the handler, is refused,
// naming the root; and the thread the founding carries in on the go-live
// checklist waits in Yusuf's Inbox, Amina mentioning him. No one at
// Lanterne reads a task without discussing it, since its participants
// discuss in every circle, so the box withheld is not walked here. Each
// browser posts on a task of its own. Screenshots light and dark go to
// `SHOTS`. Run by `cella test e2e thread`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page } from 'playwright-core'
import { post } from '@cella/org-task/api'
import { eachBrowser, serve, signIn } from './browser.ts'
import { reader, sign } from './lanterne.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-thread-shots'
const lea = 'lea@lanterne.example'
const thomas = 'thomas@lanterne.example'
const yusuf = 'yusuf@lanterne.example'
const tasks: Record<string, string> = { chromium: 't-4', firefox: 't-5', webkit: 't-6' }

const box = (page: Page) => page.locator('[data-box]')
const threads = (page: Page) => page.locator('[data-thread]')

// Waits until the page's main text holds `text`, or never does.
async function shows(page: Page, text: string, what: string, yes = true) {
  for (let i = 0; i < 100; i++) {
    const t = (await page.locator('main').first().textContent()) ?? ''
    if (t.includes(text) === yes) {
      return
    }
    await page.waitForTimeout(100)
  }
  assert.fail(`${what}: ${yes ? 'never showed' : 'still shows'} ${JSON.stringify(text)}`)
}

eachBrowser((name, launch) => {
  test(`${name}: a member posts mentioning another through the picker, who finds it in their Inbox until they reply; the root resolves and folds its reply; a reply to a reply is refused`, async () => {
    mkdirSync(shots, { recursive: true })
    const task = tasks[name]
    const su = new pg.Client()
    await su.connect()
    const app = new pg.Client({ user: 'cella_app' })
    await app.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    const contexts: BrowserContext[] = []
    // Each visit is a page of its own, left open until the end, so no
    // page is navigated away while its body's session opens or saves.
    const signed = new Map<BrowserContext, string>()
    const visit = async (context: BrowserContext, path: string) => {
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${signed.get(context)}: ${e.message}`))
      await page.goto(`${base}${path}`)
      if (path.startsWith('/tasks/')) {
        await page.waitForSelector('[data-body]:not([data-state=opening])', { timeout: 20_000 })
      }
      return page
    }
    const open = async (actor: string, path: string, scheme: 'light' | 'dark' = 'light') => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(context)
      signed.set(context, actor)
      await signIn(context, base, actor)
      return visit(context, path)
    }
    try {
      // Léa types `@Tho`, picks Thomas, and posts.
      const a = await open(lea, `/tasks/${task}`)
      const field = box(a).locator('textarea')
      await field.waitFor()
      await field.fill(`Can you check the wording in ${name}, @Tho`)
      await box(a).locator('[data-picker] button', { hasText: 'Thomas Nguyen' }).click()
      assert.equal(await field.inputValue(), `Can you check the wording in ${name}, @Thomas Nguyen `, `${name}: the picker puts Thomas's name in the box`)
      await field.fill(`${await field.inputValue()}before Friday?`)
      await box(a).getByRole('button', { name: 'Comment' }).click()
      await threads(a).first().waitFor({ timeout: 20_000 })
      await shows(a, '@Thomas Nguyen', `${name}: Léa's thread draws the mention by name`)
      const root = await su.query<{ id: string; text: string; mentions: string[] }>(
        `SELECT c.id, c.text, ARRAY(SELECT m.person FROM task.mention m WHERE m.comment = c.id ORDER BY m.n) AS mentions
         FROM task.comment c WHERE c.task = $1 AND c.author = $2`,
        [task, lea],
      )
      assert.equal(root.rows.length, 1, `${name}: Léa's comment is posted`)
      assert.equal(root.rows[0].text, `Can you check the wording in ${name}, @[${thomas}] before Friday?`, `${name}: the text holds the mention by address`)
      assert.deepEqual(root.rows[0].mentions, [thomas], `${name}: one mention, of Thomas`)
      const logged = await su.query<{ actor: string }>(`SELECT actor FROM cella.log WHERE op = 'task:comment:post' AND (form ->> 'comment') = $1`, [root.rows[0].id])
      assert.deepEqual(logged.rows, [{ actor: lea }], `${name}: the post is logged as Léa's`)

      // Thomas finds the mention in his Inbox, replies, and it leaves. The
      // browsers run at once on one Lanterne, so each reads its own task's.
      const { title } = (await su.query<{ title: string }>('SELECT title FROM task.task WHERE id = $1', [task])).rows[0]
      const b = await open(thomas, '/inbox')
      await shows(b, `Léa Bernard mentioned you on ${title}`, `${name}: Thomas's Inbox`)
      const b2 = await visit(b.context(), `/tasks/${task}`)
      await threads(b2).first().getByRole('button', { name: 'Reply' }).click()
      await box(b2).locator('textarea').fill('Checked: it reads well.')
      await box(b2).getByRole('button', { name: 'Reply' }).click()
      await shows(b2, 'Checked: it reads well.', `${name}: Thomas's reply`)
      assert.equal(await threads(b2).count(), 1, `${name}: the reply sits in Léa's thread`)
      const b3 = await visit(b.context(), '/inbox')
      await shows(b3, `Léa Bernard mentioned you on ${title}`, `${name}: Thomas's Inbox after his reply`, false)

      // Léa resolves the thread, which folds Thomas's reply away.
      const a2 = await visit(a.context(), `/tasks/${task}`)
      await shows(a2, 'Checked: it reads well.', `${name}: Léa's page after the reply`)
      await a2.screenshot({ path: `${shots}/thread-${name}-light.png`, fullPage: true })
      await threads(a2).first().getByRole('button', { name: 'Resolve' }).click()
      await a2.waitForSelector('[data-thread]:not([data-resolved=""])', { timeout: 20_000 })
      await shows(a2, 'Checked: it reads well.', `${name}: the resolved thread`, false)
      await shows(a2, 'its reply folded away', `${name}: the resolved thread says what it folded`)

      // A reply to Thomas's reply is refused, naming the root.
      const reply = await su.query<{ id: string }>(`SELECT id FROM task.comment WHERE task = $1 AND author = $2`, [task, thomas])
      const refused = await post({ task, parent: Number(reply.rows[0].id), text: 'And another thing' }, { db: reader(app, lea), actor: lea, sign: sign(lea) })
      assert.equal(refused.state, 'refused', `${name}: a reply to a reply is refused`)
      assert.equal('reason' in refused && refused.reason, `comment ${reply.rows[0].id} is a reply: reply to its root, comment ${root.rows[0].id}`)

      // The founding's thread on the go-live checklist waits on Yusuf.
      const c = await open(yusuf, '/inbox', 'dark')
      await shows(c, 'Amina Diallo mentioned you on Payment provider go-live checklist', `${name}: Yusuf's Inbox`)
      const c2 = await visit(c.context(), '/tasks/t-1')
      await shows(c2, '@Yusuf Demir', `${name}: the go-live checklist's thread`)
      await c2.screenshot({ path: `${shots}/thread-${name}-dark.png`, fullPage: true })

      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      for (const context of contexts) {
        await context.close()
      }
      await browser.close()
      await stop()
      await app.end()
      await su.end()
    }
  })
})
