// The pages' boundaries, end to end on a seeded Lanterne through the
// built shell: a collection's page and an item's read through their
// queries, the server rendering their content with its queries awaited
// and what is missing as a 404 drawn inside the shell. Then, in every
// browser, Camille opens a motion from the motions, then the documents
// and a project's tasks, read through a query written in SQL,
// their queries held: each page draws its skeleton, then its content
// once the query answers, and reading again keeps it, busy; and an item
// that is not there draws its failed snippet in the shell, which stays,
// as a settings page does, read through its own query. The sign-in and
// an invitation's link read through theirs before anyone signs in.
// Run by `cella test e2e boundary`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { inBrowsers, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const camille = 'camille@lanterne.example'

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('the server renders a page\'s content with its queries awaited, and what is missing as a 404 inside the shell', async () => {
  const motions = await shell.page('/motions', camille)
  assert.equal(motions.status, 200)
  assert.ok(motions.text.includes('Admit Inès Haddad'), 'the rows are in the page the server sends')
  assert.ok(!motions.text.includes('data-pending'), 'and no skeleton')
  const motion = await shell.page('/motions/m-2026-012', camille)
  assert.equal(motion.status, 200)
  assert.ok(motion.text.includes('passes by consent'))
  const missing = await shell.page('/motions/m-1999-001', camille)
  assert.equal(missing.status, 404)
  assert.ok(missing.text.includes('data-failed') && missing.text.includes('motions has no m-1999-001'), 'the failed snippet says what is missing')
  assert.ok(missing.text.includes('href="/motions"'), 'inside the shell, whose sidebar stays')
  const nowhere = await shell.page('/nowhere', camille)
  assert.equal(nowhere.status, 404)
  assert.ok(nowhere.text.includes('There is no collection nowhere'))
})

test('the server renders the sign-in, an invitation\'s link and a settings page through their queries, and what is not there as a 404', async () => {
  const signing = await shell.page('/sign-in?back=/motions')
  assert.equal(signing.status, 200)
  assert.ok(signing.text.includes('Sign in') && !signing.text.includes('data-pending'), 'the sign-in is in the page the server sends, and no skeleton')
  const link = await shell.page('/join/no-such-secret')
  assert.equal(link.status, 404)
  assert.ok(link.text.includes('data-failed') && link.text.includes('taken up already'), 'a link that is no one\'s draws the failed snippet')
  const account = await shell.page('/settings/account', camille)
  assert.equal(account.status, 200)
  assert.ok(account.text.includes('Profile') && !account.text.includes('data-pending'), 'a settings page is in the page the server sends')
  const nowhere = await shell.page('/settings/nowhere', camille)
  assert.equal(nowhere.status, 404)
  assert.ok(nowhere.text.includes('data-failed') && nowhere.text.includes('There is no settings page nowhere'), 'and one that is not there its failed snippet')
  assert.ok(nowhere.text.includes('aria-label="Main"'), 'inside the shell, whose sidebar stays')
  const home = await shell.page('/')
  assert.equal(home.status, 303, 'with no session, the root asks for one')
  assert.ok(home.location?.startsWith('/sign-in?back='))
})

test('in every browser, a page opened draws its skeleton while its query is held, then its content, and a missing item its failed snippet', async () => {
  await shell.stop()
  await inBrowsers(async (engine, launch) => {
    const browser = await launch()
    const dev = await serve()
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, dev.base, camille)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`${dev.base}/motions`)
      await page.waitForLoadState('networkidle')

      // Holds every remote query until `release`, so the pending state
      // can be seen.
      let release = () => {}
      const held = async () => {
        const gate = new Promise<void>((r) => (release = r))
        await page.route('**/_app/remote/**', async (route) => {
          await gate
          await route.continue()
        })
      }
      // Follows a link to `path` as a person's click does, through the
      // client's router.
      const follow = (path: string) =>
        page.evaluate((href) => {
          const a = document.createElement('a')
          a.href = href
          a.textContent = href
          document.body.append(a)
          a.click()
          a.remove()
        }, path)
      const open = async (path: string, says: string) => {
        await held()
        await follow(path)
        await page.locator('[data-pending]').waitFor({ state: 'visible' })
        assert.ok(!(await page.getByText(says).isVisible()), `${engine}: the skeleton draws no data`)
        release()
        await page.getByText(says).first().waitFor({ state: 'visible' })
        assert.equal(await page.locator('[data-pending]').count(), 0, `${engine}: the skeleton gives way to the content`)
        await page.unroute('**/_app/remote/**')
        await page.waitForURL(`${dev.base}${path}`)
      }

      // Each route mounts its page afresh: the item's from the collection,
      // and another collection's from the item, a query not read before,
      // since one the browser holds answers at once.
      await open('/motions/m-2026-012', 'passes by consent')
      await open('/documents', 'Rate card 2027')
      // A project's tasks, which its graft reads through a query written
      // in SQL, render on its page as any item's data.
      await open('/projects/halles-shop?tab=tasks', 'Fix VAT display on mixed baskets')
      // A settings page reads through its own query, as a collection does.
      await open('/settings/account', 'Profile')
      await follow('/settings/nowhere')
      await page.locator('[data-failed]').waitFor({ state: 'visible' })
      assert.ok(await page.getByText('There is no settings page nowhere').isVisible(), `${engine}: a settings page that is not there draws its failed snippet`)
      await follow('/documents')
      await page.getByText('Rate card 2027').first().waitFor({ state: 'visible' })

      // The same page reading again, for another address: it keeps what
      // it shows, its frame busy, and draws no skeleton.
      await held()
      await follow('/documents?q=Rate')
      await page.locator('[aria-busy="true"]').first().waitFor({ state: 'visible' })
      assert.ok(await page.getByText('Rate card 2027').first().isVisible(), `${engine}: the content stays while it reads again`)
      assert.equal(await page.locator('[data-pending]').count(), 0, `${engine}: and no skeleton replaces it`)
      release()
      await page.locator('.content[aria-busy="false"]').first().waitFor({ state: 'attached' })
      await page.unroute('**/_app/remote/**')

      // A motion that is not there: the item's query throws, and its
      // boundary draws it, the shell around it.
      await follow('/motions/m-1999-001')
      await page.locator('[data-failed]').waitFor({ state: 'visible' })
      assert.ok(await page.getByText('motions has no m-1999-001').isVisible(), `${engine}: the failed snippet says what is missing`)
      assert.ok(await page.getByRole('navigation', { name: 'Main' }).isVisible(), `${engine}: the shell stays`)
      assert.deepEqual(errors, [], `${engine}: the pages threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await dev.stop()
    }
  })
})
