// A mandate's page, end to end on a seeded Lanterne, through the built
// shell: Brand's page links its print buyer's approve-bill mandate, the
// deepest of the chain the bills are handed down; its page draws the
// chain from the assembly's root, coordination's, through Operations',
// each link with how it narrows the one above; the root's page lists
// what was issued under it, down to the print buyer's, and the page of
// Operations' mandate, between them, leads back down. Then, in every
// browser, light and dark, the walk is clicked through from Brand's page
// to the root and down again; `SHOTS` names where its screenshots go.
// Run by `cella test e2e lineage`.

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import { browsers, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const shots = process.env.SHOTS ?? '/tmp/cella-lineage-shots'

const camille = 'camille@lanterne.example'
const page = async (path: string) => {
  const { status, text } = await shell.page(path, camille)
  assert.equal(status, 200, path)
  return text
}
const links = (text: string) => [...text.matchAll(/href="\/mandates\/(\d+)"/g)].map((m) => m[1])

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('the print buyer\'s mandate opens from Brand\'s page, and its chain walks up to the assembly\'s root and down again', async () => {
  const id = async (grantee: string) =>
    (await su.query<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE grantee = $1 AND power = 'approve-bill'`, [grantee])).rows[0].id
  const [root, mid, deep] = [await id('coordination'), await id('operations'), await id('print-buyer')]

  assert.ok(links(await page('/circles/brand?tab=roles')).includes(deep), 'Brand\'s Roles link the print buyer\'s mandate')

  const deepest = await page(`/mandates/${deep}`)
  assert.ok(deepest.includes('(this one)'), 'the chain marks the mandate the page is of')
  assert.ok(deepest.includes('the root, the assembly'), 'the chain starts at the assembly\'s root')
  assert.ok(deepest.includes('smaller cap; Brand alone'), 'the print buyer\'s link narrows its scope to Brand')
  assert.ok(deepest.includes('Nothing is issued under it'))
  const up = links(deepest)
  assert.ok(up.indexOf(root) < up.indexOf(mid) && up.indexOf(mid) < up.indexOf(deep), 'the chain reads from the root down')

  const top = await page(`/mandates/${root}`)
  assert.ok(top.includes('the root, the assembly'))
  const down = links(top)
  assert.ok(down.includes(mid) && down.includes(deep), 'the root lists what was issued under it, down to the print buyer\'s')
  assert.ok(top.includes('href="/circles/ag"'), 'its issuer links to the assembly')
  assert.ok(top.includes('href="/circles/coordination"'), 'its grantee links to its circle')

  const between = links(await page(`/mandates/${mid}`))
  assert.ok(between.includes(root) && between.includes(deep), 'Operations\' mandate leads up to the root and down to the print buyer\'s')

  assert.ok((await page('/mandates')).includes('Approve bill'), 'the collection lists the mandates')
  assert.equal((await shell.page('/mandates/999999', camille)).status, 404)
})

test('in every browser, light and dark, the walk is clicked through from Brand\'s page up to the root and down again', async () => {
  const id = async (grantee: string) =>
    (await su.query<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE grantee = $1 AND power = 'approve-bill'`, [grantee])).rows[0].id
  const [root, mid, deep] = [await id('coordination'), await id('operations'), await id('print-buyer')]
  await shell.stop()
  mkdirSync(shots, { recursive: true })
  for (const [engine, launch] of browsers()) {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, dev.base, camille)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        const open = async (to: string) => {
          await page.locator(`a[href="/mandates/${to}"]`).first().click()
          await page.waitForURL(`${dev.base}/mandates/${to}`)
          await page.waitForLoadState('networkidle')
        }
        await page.goto(`${dev.base}/circles/brand?tab=roles`)
        await page.waitForLoadState('networkidle')
        await open(deep)
        const chain = page.locator('section', { has: page.getByRole('heading', { name: 'Chain' }) })
        assert.match((await chain.textContent()) ?? '', /this one/, `${engine}, ${scheme}: the chain marks its mandate`)
        await page.screenshot({ path: `${shots}/chain-${engine}-${scheme}.png`, fullPage: true })
        await open(root)
        const under = page.locator('section', { has: page.getByRole('heading', { name: 'Issued under it' }) })
        assert.match((await under.textContent()) ?? '', /Print buyer/, `${engine}, ${scheme}: the root lists the print buyer's under it`)
        await page.screenshot({ path: `${shots}/under-${engine}-${scheme}.png`, fullPage: true })
        await open(mid)
        await open(deep)
        assert.deepEqual(errors, [], 'the page threw nothing')
        await context.close()
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  }
})
