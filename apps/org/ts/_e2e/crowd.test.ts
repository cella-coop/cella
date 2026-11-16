// A write waiting on its signer keeps no one else waiting, end to end on
// a seeded Lanterne through the built shell, each write a person renaming
// themselves on their page and signed as their browser signs it: ten
// people start one at once and sign only once all ten wait, and every one
// settles while Inès keeps loading collection pages; then Camille starts
// three and abandons them, while others' writes settle and Inès's pages
// load, and her runs give up after two seconds (`CELLA_PATIENCE`), leaving
// nothing written and her places free. A run holds no connection while it
// waits (`lib/server/write.ts`), and the shell lends six connections to
// pages and writes and keeps two for sessions (`lib/server/db.ts`), so
// ten waiting writes leave every page and every proof one. The crowd
// posts as a device posts; in each browser in turn, Chloé renames
// herself on her own page instead, signed by the browser's key, and
// settles while the other nine wait, and Camille, once her three runs
// wait, starts a fourth on her page, which shows it failed with the cap's
// reason. The server's sign-in page offers the fixture members
// (`CELLA_DEV`), so the browser holds a member's fixture device as the
// test does. Run by `cella test e2e crowd`.

// browsers: one at a time: each browser restarts the one shell and renames the same ten people, whose names and waiting writes the others assert
// covers: core

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Browser } from 'playwright-core'
import { signer } from '@cella/org-sign'
import { eachBrowser, signIn } from './browser.ts'
import { Shell, type Ask, type Done } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)

const ten = ['camille', 'yusuf', 'hugo', 'julien', 'lea', 'thomas', 'sofia', 'malik', 'amina', 'chloe'].map((n) => `${n}@lanterne.example`)
const camille = ten[0]
// The one of the ten who signs on her own page, in the browser.
const chloe = ten[9]
const ines = 'ines@lanterne.example'

// How long a page may take to answer, in milliseconds, while writes wait.
const bound = 3000

// How long a run waits for each signature in the second scenario, in
// seconds.
const patience = 2

const pages = ['/people', '/projects', '/meetings', '/tasks', '/']

const profile = (actor: string) => `/people/${encodeURIComponent(actor)}`

// The post starting `actor`'s rename, answered with what to sign.
async function start(actor: string, cookie: string, name: string): Promise<Ask> {
  const started = await shell.post(profile(actor), 'profile', new URLSearchParams({ name }), cookie)
  assert.ok(started.sign, `${actor}'s rename asks for a signature: ${JSON.stringify(started)}`)
  return started.sign
}

// Signs what the run asks with `actor`'s device and posts each proof back,
// as the browser does, until the run's outcome.
async function sign(actor: string, cookie: string, ask: Ask): Promise<Done> {
  const device = await shell.device(actor)
  let result: Awaited<ReturnType<Shell['post']>> = { sign: ask, status: 200 }
  while (result.sign) {
    const a = result.sign
    const proof = await signer(a.scope, a.actor, device)(a.op, a.request)
    result = await shell.post(profile(actor), 'profile', new URLSearchParams({ 'cella-run': a.run, 'cella-proof': JSON.stringify(proof) }), cookie)
  }
  assert.ok(result.done, `${actor}'s rename: ${JSON.stringify(result)}`)
  return result.done
}

// `actor`'s own page in `browser`, signed in on the fixture device the
// sign-in page offers, whose renames the browser posts and signs, each
// answered with the outcome the page shows.
async function own(browser: Browser, actor: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
  await signIn(context, shell.base, actor)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
  await page.goto(`${shell.base}${profile(actor)}`)
  await page.waitForLoadState('networkidle')
  return {
    errors,
    async rename(name: string) {
      const form = page.locator('form[data-write="profile"]')
      await form.getByLabel('Name').fill(name)
      await form.getByRole('button', { name: 'Rename' }).click()
      const shown = page.locator('.outcome')
      await shown.waitFor({ timeout: 10 * bound })
      const outcome = { state: await shown.getAttribute('data-state'), text: await shown.innerText() }
      await page.getByRole('button', { name: 'Dismiss' }).click()
      await shown.waitFor({ state: 'detached' })
      return outcome
    },
    close: () => context.close(),
  }
}

// `actor` loading collection pages one after another until stopped, each
// timed; `loaded` counts them so far, and `stop` answers every time.
function browsing(actor: string) {
  const times: number[] = []
  let going = true
  let failed: unknown
  const loop = (async () => {
    for (let i = 0; going; i++) {
      const path = pages[i % pages.length]
      const t = performance.now()
      const page = await shell.page(path, actor)
      times.push(performance.now() - t)
      if (page.status !== 200) {
        throw new Error(`${path} answered ${page.status}`)
      }
    }
  })().catch((e: unknown) => (failed = e))
  return {
    loaded: () => times.length,
    async stop() {
      going = false
      await loop
      if (failed) {
        throw failed
      }
      return times
    },
  }
}

// Waits until `n` more pages have loaded, or fails the test.
async function more(reader: ReturnType<typeof browsing>, n: number) {
  const from = reader.loaded()
  for (let waited = 0; reader.loaded() < from + n; waited += 50) {
    assert.ok(waited < 10 * bound, `no ${n} pages loaded in ${10 * bound} ms`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

// Each time within the bound, and the slowest.
function within(times: number[]) {
  const slowest = Math.max(...times)
  assert.ok(slowest < bound, `the slowest of ${times.length} pages took ${Math.round(slowest)} ms, over ${bound}`)
  return slowest
}

const names = async (actors: string[]) => {
  const { rows } = await su.query<{ address: string; name: string }>(`SELECT address, name FROM person.person WHERE address = ANY($1)`, [actors])
  return Object.fromEntries(rows.map((r) => [r.address, r.name]))
}

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await su.end()
})

eachBrowser((engine, launch) => {
  let browser: Browser
  before(async () => {
    browser = await launch()
  })
  after(async () => {
    await browser?.close()
  })

  test('Ten people sign at once, Chloé on her page in the browser, and all settle while Inès keeps loading pages, each within the bound', async () => {
    await shell.start('2026-10-24', { CELLA_DEV: '1' })
    const nine = ten.filter((a) => a !== chloe)
    const cookies = await Promise.all(nine.map((a) => shell.signIn(a)))
    const hers = await own(browser, chloe)
    const reader = browsing(ines)
    await more(reader, 1)

    const asks = await Promise.all(nine.map((a, i) => start(a, cookies[i], `Crowd ${ten.indexOf(a)}`)))
    assert.equal(new Set(asks.map((a) => a.run)).size, 9, 'nine runs wait on their signatures at once')
    const shown = await hers.rename(`Crowd ${ten.indexOf(chloe)}`)
    assert.equal(shown.state, 'settled', `her page shows her rename settled while nine wait: ${shown.text}`)
    assert.match(shown.text, /Settled, log entry \d+/)
    await more(reader, pages.length)

    const done = await Promise.all(nine.map((a, i) => sign(a, cookies[i], asks[i])))
    assert.deepEqual(
      done.map((d) => d.state),
      nine.map(() => 'settled'),
      JSON.stringify(done.filter((d) => d.state !== 'settled')),
    )
    await more(reader, 1)
    const times = await reader.stop()
    const slowest = within(times)
    console.log(`# ${engine}: ${times.length} pages loaded while ten writes waited and settled, the slowest in ${Math.round(slowest)} ms`)
    assert.deepEqual(
      await names(ten),
      Object.fromEntries(ten.map((a, i) => [a, `Crowd ${i}`])),
    )
    const { rows } = await su.query<{ device: string }>(
      `SELECT encode(device, 'hex') AS device FROM cella.receipt WHERE op = 'person:person:profile' AND actor = $1 ORDER BY n DESC LIMIT 1`,
      [chloe],
    )
    assert.deepEqual(rows, [{ device: (await shell.device(chloe)).key }], 'her rename was signed in the browser by her device')
    assert.deepEqual(hers.errors, [], 'her page threw nothing')
    await hers.close()
  })

  test('Camille abandons three writes unsigned and her page fails a fourth; others’ writes settle and Inès’s pages load, and her runs give up, leaving nothing and her places free', async () => {
    await shell.start('2026-10-24', { CELLA_DEV: '1', CELLA_PATIENCE: String(patience) })
    const before = (await names([camille]))[camille]
    const hers = await own(browser, camille)
    const cookie = await shell.signIn(camille)
    const reader = browsing(ines)
    await more(reader, 1)

    const abandoned = await Promise.all([1, 2, 3].map((n) => start(camille, cookie, `Abandoned ${n}`)))
    const fourth = await hers.rename('Abandoned 4')
    assert.equal(fourth.state, 'failed', `her page shows the fourth failed: ${fourth.text}`)
    assert.match(fourth.text, /Not submitted/)
    assert.match(fourth.text, /you have 3 writes waiting on your signature; sign them or wait for them to end, then try again/)
    const others = ten.slice(1, 4)
    const settled = await Promise.all(others.map((a) => shell.act(profile(a), 'profile', { name: `Busy ${a}` }, a)))
    assert.deepEqual(
      settled.map((d) => d.state),
      others.map(() => 'settled'),
      JSON.stringify(settled),
    )
    await more(reader, pages.length)

    await new Promise((r) => setTimeout(r, patience * 1000 + 500))
    for (const ask of abandoned) {
      const late = await sign(camille, cookie, ask)
      assert.equal(late.state, 'failed')
      assert.match(late.reason ?? '', /this write is over/, 'the run gave up, and a proof after it answers nothing')
    }
    assert.equal((await names([camille]))[camille], before, 'neither her abandoned runs nor the failed fourth wrote anything')

    const again = await hers.rename('Camille again')
    assert.equal(again.state, 'settled', `her places are free again: ${again.text}`)
    assert.equal((await names([camille]))[camille], 'Camille again')
    const times = await reader.stop()
    const slowest = within(times)
    console.log(`# ${engine}: ${times.length} pages loaded while Camille's runs waited and gave up, the slowest in ${Math.round(slowest)} ms`)
    assert.deepEqual(hers.errors, [], 'her page threw nothing')
    await hers.close()
  })
})
