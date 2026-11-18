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
// and dark go to `SHOTS`. Run by `cella test e2e body`. One drawer
// property, which saves the same way core body's own save does, has the
// same window an edit followed at once by a reload opens, so Yusuf
// types a project's budget and reloads at once too.
// covers: task project

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import type { BrowserContext, Page, Route } from 'playwright-core'
import { browsers, eachBrowser, serve, signIn } from './browser.ts'

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

// Two tabs on a task whose body was never saved save from one base: once
// Léa's line has reached Thomas, he types one of his own and both tabs
// save at once, as on leaving, each naming no saved body as its base. The
// task's guard refuses whichever lands second for its base; that browser
// reads the saved body, merges it and saves what it holds that the first
// did not, so the reload holds both members' edits and a stale snapshot
// erased neither. In Chromium.
const chromium = browsers().find(([name]) => name === 'chromium')
test('chromium: two tabs saving from one base keep both members’ edits', { skip: !chromium }, async () => {
  const task = 't-7'
  const su = new pg.Client()
  await su.connect()
  const { base, stop } = await serve()
  const browser = await chromium![1]()
  const errors: string[] = []
  try {
    const open = async (actor: string) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, actor)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${actor}: ${e.message}`))
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit][data-state=saved]', { timeout: 20_000 })
      return page
    }
    const none = await su.query<{ body: Buffer | null }>('SELECT body FROM task.task WHERE id = $1', [task])
    assert.equal(none.rows[0]?.body ?? null, null, 'the task holds no saved body yet')
    const a = await open(lea)
    const b = await open(thomas)
    const first = 'Léa writes from no saved body'
    await editor(a).locator('[contenteditable=true]').first().click()
    await a.keyboard.type(first)
    await shows(b, [first], "Thomas's tab")
    const second = 'Thomas writes from no saved body'
    await editor(b).locator('[contenteditable=true]').last().click()
    await b.keyboard.press('End')
    await b.keyboard.press('Enter')
    await b.keyboard.type(second)
    // Both tabs hide at once, which saves each from the base it holds.
    const hide = () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    await Promise.all([a.evaluate(hide), b.evaluate(hide)])
    await saved(a)
    await saved(b)
    const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
    assert.match(row.rows[0]?.text ?? '', new RegExp(`${first}[\\s\\S]*${second}`), "the task's column holds both members' edits")
    const entries = await su.query<{ base: string; replaced: string }>(
      `SELECT cella.opened(n) ->> 'base' AS base, cella.opened(n) ->> 'replaced' AS replaced FROM cella.log
       WHERE op = 'task:body:save' AND cella.opened(n) ->> 'task' = $1 ORDER BY n`,
      [task],
    )
    assert.ok(entries.rows.length >= 1, 'the body was saved by task:body:save')
    assert.equal(entries.rows[0].base, '', 'the first save names no saved body as its base')
    assert.ok(
      entries.rows.every((e) => e.base === e.replaced),
      'every save landed replaced the body its base names',
    )
    await a.reload()
    await a.waitForSelector('[data-body=edit]', { timeout: 20_000 })
    await shows(a, [first, second], "Léa's tab after a reload")
    assert.deepEqual(errors, [], 'the pages threw nothing')
  } finally {
    await browser.close()
    await stop()
    await su.end()
  }
})

// An edit held unsaved is not dropped on leaving, before its own pause
// would have saved it: a tab hidden saves it at once instead of waiting,
// as the dead task the hiding's save used to wait on, past `pagehide`,
// would have abandoned it on a real leave. A reload once it is saved
// opens on it, as any save's does. In Chromium and WebKit.
const reloadTasks: Record<string, string> = { chromium: 't-8', webkit: 't-9' }
for (const [name, launch] of browsers().filter(([n]) => n in reloadTasks)) {
  test(`${name}: an edit held unsaved is saved as soon as the tab hides, not at its pause`, async () => {
    const task = reloadTasks[name]
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, lea)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      const line = `Léa's edit, saved on hiding in ${name}`
      await editor(page).locator('[contenteditable=true]').first().click()
      await page.keyboard.type(line)
      assert.equal(
        await page.evaluate(() => document.querySelector('[data-body]')?.getAttribute('data-state')),
        'saving',
        `${name}: the edit is held unsaved before the tab hides`,
      )
      // The tab hides well before the 3 s pause that would otherwise
      // save it; a real edit held unsaved is saved at once instead.
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await saved(page)
      await page.reload()
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(page, [line], `${name}: the reopened tab`)
      const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
      assert.match(row.rows[0]?.text ?? '', new RegExp(line), `${name}: the task's column holds the edit`)
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
}

// Opening a task whose body was never saved, then leaving it, past its
// pause and for another document, saves nothing there: the editor's
// empty-paragraph seed is not an edit, so merely viewing it dirties
// nothing. In Chromium and WebKit.
const viewTasks: Record<string, string> = { chromium: 't-3', webkit: 't-2' }
for (const [name, launch] of browsers().filter(([n]) => n in viewTasks)) {
  test(`${name}: viewing a task's body, never edited, saves nothing at its pause or on leaving`, async () => {
    const task = viewTasks[name]
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    try {
      const before = await su.query<{ body: Buffer | null }>('SELECT body FROM task.task WHERE id = $1', [task])
      assert.equal(before.rows[0]?.body ?? null, null, `${name}: the task holds no saved body yet`)
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, lea)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      // Past the 3 s pause a real edit would have saved at.
      await page.waitForTimeout(3_500)
      await page.goto(`${base}/inbox`)
      const after = await su.query<{ body: Buffer | null }>('SELECT body FROM task.task WHERE id = $1', [task])
      assert.equal(after.rows[0]?.body ?? null, null, `${name}: viewing it saved no body, at its pause or on leaving`)
      const saves = await su.query(`SELECT 1 FROM cella.log WHERE op = 'task:body:save' AND cella.opened(n) ->> 'task' = $1`, [task])
      assert.equal(saves.rowCount, 0, `${name}: viewing it made no save entry`)
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
}

// An edit followed at once by a reload, with nothing dispatched between
// the keystroke and it, still survives: this browser kept it the moment
// it was made, before the signed save itself, two round trips, had any
// chance to post it, let alone finish; the reload opens on it at once,
// from what was kept, and a second reload, in a context of its own that
// kept nothing, still shows it, so it reached the server and was not
// merely kept in the first context's own storage. In every browser.
const reloadNowTasks: Record<string, string> = { chromium: 't-33', firefox: 't-41', webkit: 't-57' }
for (const [name, launch] of browsers().filter(([n]) => n in reloadNowTasks)) {
  test(`${name}: an edit followed at once by a reload survives it, saved to the server`, async () => {
    const task = reloadNowTasks[name]
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    const contexts: BrowserContext[] = []
    const open = async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      contexts.push(context)
      await signIn(context, base, lea)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
      return page
    }
    try {
      const page = await open()
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      const line = `Léa's edit, reloaded at once in ${name}`
      await editor(page).locator('[contenteditable=true]').last().click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.type(line)
      // No wait between the last keystroke and the reload: a real
      // reload, not a simulated hide, racing the save's two round trips.
      await page.reload()
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(page, [line], `${name}: right after the reload`)
      await saved(page)

      // A context of its own, holding nothing the first kept, opens on
      // the same task: what it shows, it shows only because the server
      // itself holds it now.
      const fresh = await open()
      await fresh.goto(`${base}/tasks/${task}`)
      await fresh.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(fresh, [line], `${name}: a fresh context, which kept nothing of its own`)

      const row = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
      assert.match(row.rows[0]?.text ?? '', new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name}: the task's column holds the edit`)
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
}

// A drawer property has the same window: its popover's text field
// commits on Enter alone, which starts its own signed write; Yusuf
// types a project's budget, presses Enter and reloads at once, before
// that write is known to have landed. It survives all the same, kept
// until the Details drawer mounts again, which posts it once more. In
// Chromium: the window is the write's, not the body's, so one browser
// proves it.
const yusuf = 'yusuf@lanterne.example'
if (chromium) {
  test('chromium: a drawer property accepted and reloaded at once still reaches the server', async () => {
    const project = 'clairval-site'
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await chromium[1]()
    const errors: string[] = []
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, yusuf)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${base}/projects/${project}`)
      await page.getByRole('tab', { name: 'Details' }).click()
      const drawer = page.getByRole('complementary', { name: 'Details' })
      await drawer.getByRole('button', { name: /^Budget/ }).click()
      const dialog = page.getByRole('dialog', { name: 'Budget' })
      await dialog.waitFor()
      const input = dialog.getByRole('spinbutton', { name: 'Budget' })
      await input.fill('9000')
      // Enter alone accepts it, starting the signed write; the reload
      // follows at once, with nothing awaited in between.
      await input.press('Enter')
      await page.reload()
      let budget: number | null = null
      for (let i = 0; i < 100; i++) {
        const row = await su.query<{ budget: string | null }>('SELECT budget FROM project.project WHERE id = $1', [project])
        budget = row.rows[0]?.budget === null || row.rows[0]?.budget === undefined ? null : Number(row.rows[0].budget)
        if (budget === 9_000) {
          break
        }
        await page.waitForTimeout(100)
      }
      assert.equal(budget, 9_000, "the project's budget reached the server after the reload")
      assert.deepEqual(errors, [], 'the pages threw nothing')
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
}

// A draft is kept by this browser, not by the record: Léa types into a
// task's body, its own save blocked so nothing of it ever reaches the
// server, and reloads away without it saving. The draft still shows her
// edit, from what was kept. She signs out and Thomas signs in on the
// same browser; he opens the same task and sees none of her edit, and
// nothing of it ever reaches the server either, signed out or not. In
// every browser.
const signOutTasks: Record<string, string> = { chromium: 't-1', firefox: 't-42', webkit: 't-43' }
for (const [name, launch] of browsers().filter(([n]) => n in signOutTasks)) {
  test(`${name}: signing out drops a draft, so the next person on this browser is never shown or sent it`, async () => {
    const task = signOutTasks[name]
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, lea)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })

      // From here on, both of this browser's two write paths are
      // blocked: the signed save itself, a SvelteKit remote command
      // posted to `_app/remote/<id>` (`send`, `prove`, as every write
      // is, not only the body's), and the session's own posts to the
      // body's live address. Nothing else is routed through this at
      // all: `/sign-out` works, and the editor's own built assets,
      // its wasm among them, are never raced by it.
      const block = (route: Route) => (route.request().method() === 'POST' ? route.abort() : route.continue())
      await page.route('**/_app/remote/**', block)
      await page.route('**/body/live', block)

      const line = `Léa's blocked edit, never saved, in ${name}`
      await editor(page).locator('[contenteditable=true]').last().click()
      await page.keyboard.press('End')
      await page.keyboard.press('Enter')
      await page.keyboard.type(line)
      await page.reload()
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      await shows(page, [line], `${name}: right after the reload, from what was kept`)

      const blocked = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
      assert.ok(!(blocked.rows[0]?.text ?? '').includes(line), `${name}: the blocked save never reached the server`)

      await page.getByRole('button', { name: /^Léa Bernard/ }).click()
      await page.getByRole('button', { name: 'Sign out' }).click()
      await page.waitForURL(`${base}/sign-in`)
      // Léa's document is gone with the navigation that signed her out;
      // Thomas's own sign-in, and his writes after it, are not blocked.
      await page.unrouteAll()

      await page.getByTitle(thomas).click()
      await page.waitForURL(`${base}/inbox`)
      // Firefox: a module import right after this many navigations in
      // one page can race its own module cache; settling here first,
      // unrelated to anything this scenario checks, avoids it.
      await page.waitForLoadState('networkidle')
      await page.goto(`${base}/tasks/${task}`)
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      const shown = (await page.locator('main [role=document]').first().textContent()) ?? ''
      assert.ok(!shown.includes(line), `${name}: Thomas is shown none of Léa's blocked edit`)

      // Past the pause a real edit would have saved at, were it this
      // browser's own and not blocked, so a delayed post would have
      // had every chance to land by now.
      await page.waitForTimeout(3_500)
      const after = await su.query<{ text: string }>('SELECT cella.document_text(body) AS text FROM task.task WHERE id = $1', [task])
      assert.ok(!(after.rows[0]?.text ?? '').includes(line), `${name}: nothing of Léa's draft was ever posted, signed out or not`)
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
}
