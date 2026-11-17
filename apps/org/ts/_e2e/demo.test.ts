// A demo build, end to end on a seeded Lanterne: the built server outside
// dev mode with `CELLA_DEMO`, as `cella serve --prod --demo` and the NixOS
// module's demo option run it. Its sign-in offers Lanterne's fixture
// members, under one demo tag on the heading, and a member signed in with
// their TEST-ONLY device finds the banner on their pages and writes
// through the notary. The same build without it, a scope's server, offers
// no one and wears no banner. A visitor's copy, as `cella demo serve`
// starts its server with `CELLA_DEMO_IDLE`, says on every page it is the
// visitor's own and offers Reset; a room's lifetime
// (`CELLA_DEMO_LIFETIME`) counts down only once its first member signs
// in, never before; and, in a real browser, a successful Copy invite
// stays on the page and shows Copied, never following the link.
// covers: core

import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { chromium } from 'playwright-core'
import { fixture, random, sha256 } from '@cella/org-sign'
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

it('a demo build offers every fixture member at its sign-in, under one demo tag on the heading, under the demo banner', async () => {
  await shell.start('2026-10-24', { CELLA_DEMO: '1' })
  const { text } = await shell.page('/sign-in')
  // The members whose device in force is a fixture's, its key derived from
  // their address and its label, as the sign-in offers them.
  const devices = (await su.query<{ address: string; label: string; key: string }>("SELECT address, label, encode(key, 'hex') AS key FROM person.device WHERE revoked IS NULL")).rows
  const derived = await Promise.all(devices.map(async (d) => ((await fixture(d.address, d.label)).key === d.key ? d.address : null)))
  const members = new Set(derived.filter((a) => a !== null)).size
  assert.ok(members > 0, 'Lanterne enrols its members’ fixture devices')
  assert.match(text, /Demo members/)
  assert.equal(text.split('>demo</span>').length - 1, 1, 'only the heading wears the demo tag, not each row')
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
