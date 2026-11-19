// A demo build, end to end on a seeded Lanterne: the built server outside
// dev mode with `CELLA_DEMO`, as `cella serve --prod --demo` and the NixOS
// module's demo option run it. Its sign-in offers Lanterne's fixture
// members, under a heading naming them the demo’s, and a member signed in with
// their TEST-ONLY device finds the banner on their pages and writes
// through the notary. The same build without it, a scope's server, offers
// no one and wears no banner. A visitor's copy, as `cella demo serve`
// starts its server with `CELLA_DEMO_IDLE`, says on every page it is the
// visitor's own and offers Reset; a room's lifetime
// (`CELLA_DEMO_LIFETIME`) counts down only once its first member signs
// in, never before; and, in a real browser, a successful Copy invite
// stays on the page and shows Copied, never following the link. A
// member's lease that lapsed while its browser was away is renewed where
// no one took the member since; where another did, the session ends,
// for good even once the taker lets the member go, and the browser is
// sent to the sign-in, which names who was freed, by the room's own
// record, never a link's; a kept session cookie never renews under
// another browser's id; and a session or a sign-in naming no browser is
// refused, as ever. A scope's server, no room, answers a query without a
// session 401, as ever.
// covers: core

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { parse } from 'devalue'
import { chromium } from 'playwright-core'
import { fixture, open as opening, random, sha256 } from '@cella/org-sign'
import { signIn } from './browser.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
const camille = 'camille@lanterne.example'
const banner = "This is a prototype environment for demo purposes and can't be used for real work."

// The demo banner's own markup, no deeper div nested in it, so a full
// page's own content (a meeting's time, a task's, …) never reads as its
// countdown.
const strip = (text: string) => text.match(/<div class="demo[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ''

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await su.end()
})

it('a demo build offers every fixture member at its sign-in, under a heading naming them the demo’s, under the demo banner', async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1' })
  const { text } = await shell.page('/sign-in')
  // The members whose device in force is a fixture's, its key derived from
  // their address and its label, as the sign-in offers them.
  const devices = (await su.query<{ address: string; label: string; key: string }>("SELECT address, label, encode(key, 'hex') AS key FROM person.device WHERE revoked IS NULL")).rows
  const derived = await Promise.all(devices.map(async (d) => ((await fixture(d.address, d.label)).key === d.key ? d.address : null)))
  const members = new Set(derived.filter((a) => a !== null)).size
  assert.ok(members > 0, 'Lanterne enrols its members’ fixture devices')
  assert.match(text, /Demo members/)
  assert.ok(!text.includes('>demo</span>'), 'nothing wears a demo tag: the heading says it')
  assert.doesNotMatch(text, /demo member/, 'no row wears its own demo badge')
  assert.match(text, /Camille Martin/)
  assert.ok(text.includes(banner), 'the sign-in wears the demo’s banner')
  assert.doesNotMatch(text, /Fixture members/)
})

it('a demo member signs in with their derived key, finds the banner on their pages and writes through the notary', async () => {
  const { text } = await shell.page('/inbox', camille)
  assert.ok(text.includes(banner), 'a signed-in page wears the demo’s banner')
  const done = await shell.act('/people', 'invite', { name: 'Demo Petit', address: 'demo.petit@lanterne.example', link: await sha256(random()) }, camille)
  assert.equal(done.state, 'settled', done.reason)
  assert.ok(shell.signed > 0, 'the member’s device signed it')
})

it('the same build with no demo offers no one and wears no banner', async () => {
  await shell.start('2026-10-24')
  const { text } = await shell.page('/sign-in')
  assert.doesNotMatch(text, /Demo members|Fixture members|demo member/)
  assert.ok(!text.includes(banner), 'a scope’s server wears no demo banner')
  const asked = await fetch(`${shell.base}/_app/remote/0/index`, { headers: { 'x-forwarded-proto': 'http' } })
  assert.equal(asked.status, 401, 'a query without a session is refused, never answered with a room’s redirect')
})

it("a visitor's copy says it is theirs and offers Reset, signed in or not, and shows no countdown far from either reset", async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1', CELLA_DEMO_IDLE: '7200' })
  for (const [path, who] of [['/sign-in', undefined], ['/inbox', camille]] as const) {
    const { text } = await shell.page(path, who)
    assert.ok(text.includes(banner), `${path} wears the prototype notice`)
    assert.match(text, /This copy of it is yours alone/, `${path} says the copy is the visitor’s own`)
    assert.match(text, /resets after 2 hours idle/, `${path} says when the copy resets`)
    // No lifetime is set, and the idle reset is two hours off, nowhere
    // near its last two minutes: the strip shows no countdown at all.
    assert.doesNotMatch(strip(text), /\d:\d\d:\d\d/, `${path} shows a countdown with nothing close enough to warrant one`)
    assert.match(text, /action="\/_demo\/reset"/, `${path} posts Reset to the front`)
    assert.match(text, />Reset</, `${path} offers Reset`)
  }
})

it("a room's lifetime counts down only once its first member has signed in, never before", async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1', CELLA_DEMO_IDLE: '7200', CELLA_DEMO_LIFETIME: '7200' })
  const before = await shell.page('/sign-in')
  assert.doesNotMatch(strip(before.text), /\d:\d\d:\d\d/, 'no one has signed in: the strip shows no countdown yet')
  const after = await shell.page('/inbox', camille)
  assert.match(strip(after.text), /\d:\d\d:\d\d/, 'camille’s sign-in starts the room’s lifetime, which the strip now counts down')
  assert.doesNotMatch(strip(after.text), />0:00:00</, 'the lifetime just started; it has not run out')
})

// browsers: Chromium alone: clipboard permissions are its own to grant.
it('a successful Copy invite leaves the page where it is and shows Copied, never following the link', async () => {
  const join = 'e2e-join-code'
  await shell.start('2026-10-24', { CELLA_DEMO: '1', CELLA_DEMO_IDLE: '7200', CELLA_DEMO_JOIN: join })
  const browser = await chromium.launch()
  try {
    // A real browser against the bare shell, never through the room's own
    // front (`tools/demo-serve.mjs`): `x-cella-browser` stands in for what
    // the front would hand it, so this one browser may hold camille's
    // lease at all (`#lib/server/leases.ts`'s `grant`, which refuses a
    // sign-in naming none, inside a room).
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http', 'x-cella-browser': 'e2e-copy-invite' } })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: shell.base })
    await signIn(context, shell.base, camille)
    const page = await context.newPage()
    await page.goto(`${shell.base}/inbox`)
    const link = page.getByRole('link', { name: 'Copy invite' })
    await link.click()
    await page.getByRole('link', { name: 'Copied' }).waitFor()
    assert.equal(page.url(), `${shell.base}/inbox`, 'the click never followed the link')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    assert.match(clipboard, new RegExp(`/_demo/join#${join}$`), 'the room’s own link, join code and all, is what was copied')
  } finally {
    await browser.close()
  }
})

it('dismissing the banner leaves its watermark with the timer, + brings it back, and a reload keeps it dismissed', async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1', CELLA_DEMO_IDLE: '7200', CELLA_DEMO_LIFETIME: '7200' })
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http', 'x-cella-browser': 'e2e-dismiss-banner' } })
    await signIn(context, shell.base, camille)
    const page = await context.newPage()
    await page.goto(`${shell.base}/inbox`)
    await page.getByRole('button', { name: 'Hide the demo banner' }).click()
    assert.ok(await page.getByText('Prototype', { exact: true }).isVisible(), 'the watermark names the prototype')
    await page.getByText(/\d:\d\d:\d\d/).waitFor()
    const show = page.getByRole('button', { name: 'Show the demo banner' })
    await show.waitFor()
    await show.click()
    await page.getByRole('button', { name: 'Hide the demo banner' }).waitFor()
    await page.getByRole('button', { name: 'Hide the demo banner' }).click()
    await page.reload()
    await page.getByRole('button', { name: 'Show the demo banner' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Hide the demo banner' }).count(), 0, 'the strip stays dismissed across the reload')
  } finally {
    await browser.close()
  }
})

// A room's lease, lapsed: each browser here is a header, as the front's
// hash of its cookie is, and a browser is idle after a second.
describe("a room's lease that lapsed while its browser was away", () => {
  const idle = 1
  const lapse = () => new Promise((r) => setTimeout(r, idle * 1000 + 500))
  const as = (browser: string | null, more: Record<string, string> = {}) => ({ 'x-forwarded-proto': 'http', ...(browser ? { 'x-cella-browser': browser } : {}), ...more })
  // Opens `actor`'s session on `browser`, as the sign-in page does: the
  // session's cookie, or the status the server refused it with.
  const open = async (browser: string | null, actor: string) => {
    const d = await shell.device(actor)
    const { challenge, scope } = (await (await fetch(`${shell.base}/session`, { headers: as(browser) })).json()) as { challenge: string; scope: string }
    const res = await fetch(`${shell.base}/session`, {
      method: 'POST',
      headers: as(browser, { 'content-type': 'application/json' }),
      body: JSON.stringify({ actor, device: d.key, challenge, sig: await opening(scope, actor, d, challenge) }),
    })
    return res.ok ? (res.headers.get('set-cookie') ?? '').split(';')[0]! : res.status
  }
  const inbox = (browser: string | null, cookie: string) => fetch(`${shell.base}/inbox`, { headers: as(browser, { accept: 'text/html', cookie }), redirect: 'manual' })
  // Any query a page's script asks that needs a session: the hook
  // answers it before any query runs.
  const query = (browser: string, cookie: string) => fetch(`${shell.base}/_app/remote/0/index`, { headers: as(browser, { cookie }) })
  // The sign-in's text, as `browser` is served it.
  const signin = async (browser: string, path = '/sign-in') => (await fetch(`${shell.base}${path}`, { headers: as(browser, { accept: 'text/html' }) })).text()
  const notice = 'You were away a while, so Camille Martin was freed for others. Pick someone to continue.'
  const signOut = (browser: string, cookie: string) => fetch(`${shell.base}/sign-out`, { method: 'POST', headers: as(browser, { cookie, origin: shell.base }), redirect: 'manual' })

  before(async () => {
    await shell.start('2026-10-24', { CELLA_DEMO: '1', CELLA_DEMO_IDLE: '7200', CELLA_DEMO_BROWSER_IDLE: String(idle) })
  })

  it('is renewed on its next request where no one took the member, and the visitor carries on', async () => {
    const cookie = await open('e2e-lapse-back', camille)
    assert.equal(typeof cookie, 'string', 'camille signs in')
    await lapse()
    // Another browser's request finds the first idle and frees camille.
    assert.equal((await fetch(`${shell.base}/sign-in`, { headers: as('e2e-lapse-other') })).status, 200)
    const back = await inbox('e2e-lapse-back', cookie as string)
    assert.equal(back.status, 200, 'the page answers, never the sign-in or a 401')
    assert.equal(await open('e2e-lapse-other', camille), 409, 'camille is the first browser’s again, so no other may take her')
    await lapse()
  })

  it('ends the session where another browser took the member, sending it to the sign-in, which says so', async () => {
    const cookie = (await open('e2e-lapse-away', camille)) as string
    await lapse()
    const taker = await open('e2e-lapse-taker', camille)
    assert.equal(typeof taker, 'string', 'camille, freed, is another browser’s now')
    const page = await inbox('e2e-lapse-away', cookie)
    assert.equal(page.status, 303)
    assert.equal(page.headers.get('location'), '/sign-in?back=%2Finbox', 'the link names no one')
    assert.ok(page.headers.getSetCookie().some((c) => /^cella-session=;/.test(c)), 'the session’s cookie is cleared')
    const asked = await query('e2e-lapse-away', cookie)
    assert.equal(asked.status, 200, 'a query is answered as the client follows a redirect, never a 401')
    const out = (await asked.json()) as { type: string; data: string }
    assert.equal(out.type, 'result')
    assert.deepEqual(parse(out.data), { redirect: '/sign-in/ended/now' })
    const ended = await fetch(`${shell.base}/sign-in/ended/now`, { headers: as('e2e-lapse-away', { accept: 'text/html' }), redirect: 'manual' })
    assert.equal(ended.status, 303)
    assert.equal(ended.headers.get('location'), '/sign-in', 'loaded in full, it lands on the sign-in')
    assert.ok((await signin('e2e-lapse-away')).includes(notice), 'the sign-in says, to the browser it was taken from, who was freed')
    assert.ok(!(await signin('e2e-lapse-taker')).includes('You were away'), 'and to no other browser')
    assert.equal(await open('e2e-lapse-away', camille), 409, 'and camille stays the taker’s')
    await lapse()
  })

  it('never names anyone freed by a link’s say-so alone', async () => {
    for (const away of [camille, 'nobody@example.org']) {
      const text = await signin('e2e-lapse-crafted', `/sign-in?away=${encodeURIComponent(away)}`)
      assert.ok(!text.includes('You were away'), `a crafted ?away=${away} names no one`)
    }
  })

  it('stays ended once another browser took the member, even after that browser lets it go', async () => {
    const cookie = (await open('e2e-lapse-first', camille)) as string
    await lapse()
    const taker = (await open('e2e-lapse-second', camille)) as string
    assert.equal(typeof taker, 'string', 'camille, freed, is another browser’s now')
    assert.equal((await signOut('e2e-lapse-second', taker)).status, 303, 'the taker signs out, freeing camille')
    const back = await inbox('e2e-lapse-first', cookie)
    assert.equal(back.status, 303, 'the first browser’s old session revives no more')
    assert.equal(back.headers.get('location'), '/sign-in?back=%2Finbox')
    assert.ok((await signin('e2e-lapse-first')).includes(notice), 'its sign-in says camille was freed for others')
    assert.equal(typeof (await open('e2e-lapse-first', camille)), 'string', 'free, camille may be signed into afresh')
    await lapse()
  })

  it('never renews a kept session cookie under another browser’s id', async () => {
    const cookie = (await open('e2e-lapse-kept', camille)) as string
    await lapse()
    // The same cookie, as a browser back in the room under a fresh
    // visitor cookie, so a fresh id, would send it.
    const back = await inbox('e2e-lapse-rejoined', cookie)
    assert.equal(back.status, 303, 'refused under the new id')
    assert.equal(await inbox('e2e-lapse-kept', cookie).then((r) => r.status), 200, 'renewed under the id that opened it, no other browser having been granted camille')
    await lapse()
  })

  it('never renews a session its browser signed out of', async () => {
    const cookie = (await open('e2e-lapse-out', camille)) as string
    assert.equal((await signOut('e2e-lapse-out', cookie)).status, 303)
    assert.equal((await inbox('e2e-lapse-out', cookie)).status, 303, 'the session signed out of, replayed, is refused')
  })

  // browsers: Chromium alone: what it proves is the server's answer, which
  // every browser's SvelteKit client follows alike.
  it('in a browser, the next click after the member was taken lands on the sign-in, saying so, never on a broken page', async () => {
    const browser = await chromium.launch()
    try {
      const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http', 'x-cella-browser': 'e2e-lapse-page' } })
      await signIn(context, shell.base, camille)
      const page = await context.newPage()
      await page.goto(`${shell.base}/inbox`, { waitUntil: 'networkidle' })
      const people = page.locator('nav a[href="/people"]').first()
      await people.waitFor()
      await lapse()
      assert.equal(typeof (await open('e2e-lapse-page-taker', camille)), 'string', 'another browser takes camille, freed')
      await people.click()
      await page.waitForURL((u) => u.pathname === '/sign-in')
      await page.getByText(notice).waitFor()
      assert.equal(await page.getByText('Something broke').count(), 0, 'no error page')
      // Loaded in full, the sign-in stands in the gate, never inside the
      // ended session's shell and its navigation.
      assert.equal(await page.locator('nav a[href="/people"]').count(), 0, 'the signed-in shell is gone')
    } finally {
      await browser.close()
    }
    await lapse()
  })

  it('refuses a session that names no browser, and a sign-in that names none', async () => {
    const cookie = (await open('e2e-lapse-none', camille)) as string
    const page = await inbox(null, cookie)
    assert.equal(page.status, 303)
    assert.equal(page.headers.get('location'), '/sign-in?back=%2Finbox', 'refused with no word of anyone freed')
    assert.equal(await open(null, camille), 409)
  })
})
