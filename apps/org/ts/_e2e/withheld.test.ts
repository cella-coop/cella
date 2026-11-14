// A mandate's chain as a reader who does not read the whole of it sees
// it, end to end on a seeded Lanterne, through the built shell: Inès,
// employed and no member, holds Brand's print buyer role, and its
// approve-bill mandate's page draws the link she reads under a line
// saying the links above are withheld, names no root and none of
// Operations' or coordination's links; Camille, a member, reads the same
// page from the assembly's root. Then, in every browser, light and
// dark, Inès opens it and finds the same; `SHOTS` names where its
// screenshots go. Run by `cella test e2e withheld`.
// unfolded: it hands the print buyer role from Sofia to Inès around the notary, since no write of the scenario seats a role's holder

import { after, before, test } from 'node:test'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import pg from 'pg'
import { inBrowsers, serve, signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const shots = process.env.SHOTS ?? '/tmp/cella-withheld-shots'

const camille = 'camille@lanterne.example'
const ines = 'ines@lanterne.example'
const withheld = 'The links above are withheld from you.'
const root = 'the root, the assembly'
const id = async (grantee: string) =>
  (await su.query<{ id: string }>(`SELECT id::text FROM circle.mandate WHERE grantee = $1 AND power = 'approve-bill'`, [grantee])).rows[0].id

before(async () => {
  await su.connect()
  // The host hands Brand's print buyer role from Sofia to Inès, who is
  // no member, around the notary, as only a superuser may.
  await su.query('SET cella.unbound = on')
  await su.query(`UPDATE circle.tenure SET holder = $1 WHERE role = 'print-buyer' AND circle = 'brand'`, [ines])
  await shell.start('2026-10-24')
})

after(async () => {
  await shell.stop()
  await su.end()
})

test('Inès, who holds the print buyer role and is no member, reads its mandate\'s chain withheld above her link, and Camille from the root', async () => {
  const [top, mid, deep] = [await id('coordination'), await id('operations'), await id('print-buyer')]
  const page = async (path: string, actor: string) => {
    const { status, text } = await shell.page(path, actor)
    assert.equal(status, 200, `${path} as ${actor}`)
    return text
  }
  const links = (text: string) => [...text.matchAll(/href="\/mandates\/(\d+)"/g)].map((m) => m[1])

  const hers = await page(`/mandates/${deep}`, ines)
  assert.ok(hers.includes(withheld), 'the chain says the links above hers are withheld')
  assert.ok(!hers.includes(root), 'no link she reads is called the root')
  assert.ok(hers.includes('the one above is withheld'))
  assert.ok(!links(hers).includes(mid) && !links(hers).includes(top), 'the page links neither withheld mandate')
  assert.ok(!hers.includes('Operations') && !hers.includes('Coordination'), 'and names neither grantee')
  assert.equal((await shell.page(`/mandates/${mid}`, ines)).status, 404, 'the link above is not hers to open')

  const theirs = await page(`/mandates/${deep}`, camille)
  assert.ok(theirs.includes(root), 'a member reads the chain from the assembly\'s root')
  assert.ok(!theirs.includes(withheld))
})

test('in every browser, light and dark, Inès opens the print buyer\'s mandate and finds its chain withheld above her link', async () => {
  const deep = await id('print-buyer')
  await shell.stop()
  mkdirSync(shots, { recursive: true })
  await inBrowsers(async (engine, launch) => {
    const browser = await launch()
    const dev = await serve()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        await signIn(context, dev.base, ines)
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${dev.base}/mandates/${deep}`)
        await page.waitForLoadState('networkidle')
        const chain = (await page.locator('section', { has: page.getByRole('heading', { name: 'Chain' }) }).textContent()) ?? ''
        assert.ok(chain.includes(withheld), `${engine}, ${scheme}: the chain says the links above are withheld`)
        assert.ok(!chain.includes(root), `${engine}, ${scheme}: and calls no link the root`)
        await page.screenshot({ path: `${shots}/withheld-${engine}-${scheme}.png`, fullPage: true })
        assert.deepEqual(errors, [], 'the page threw nothing')
        await context.close()
      }
    } finally {
      await browser.close()
      await dev.stop()
    }
  })
})
