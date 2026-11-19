// tools/qa/idle.mjs: a visitor's idle return, walked through the demo's
// real front (`tools/demo-serve.mjs`) and the room's own server, as the
// operator would walk it: sign in, leave the tab past `--browser-idle`,
// click. The room's rule holds (a member is one browser's at a time),
// and a browser coming back to a room that still lives lands back in it,
// never on a fresh copy: its member renewed where no one took it, else
// the sign-in, saying who was freed. Never against production: it
// stands up its own throwaway cluster and front on loopback
// (`front.mjs`), torn down when it ends, pass or fail.
//
// Prerequisites, once, in this checkout:
//   nix develop -c cella db start   # builds the extension under .data/ext
//   nix develop -c cella build      # the shell this serves, apps/org/ts/build
//
// Then:
//   nix develop -c node tools/qa/idle.mjs
//
// QA_FRONT_PORT picks the front's port (default 31011). Takes about two
// minutes, most of it deliberate waits past the front's own
// `--browser-idle`, 6 s here, and, last, past the room's own `--idle`,
// 30 s, where a page whose room ended under it lands on the loading
// page, saying so, never on a broken one.

import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { buildTemplate, cleanups, fixtureButton, freshRoom, inviteCode, isTaken, joinRoom, log, named, NAME, signIn, sleep, startCluster, startFront, stop } from './front.mjs'

named('idle qa')
const PORT = Number(process.env.QA_FRONT_PORT ?? 31011)
const FRONT = `http://127.0.0.1:${PORT}`
const IDLE_S = 6
// A wide margin past `--browser-idle`, so a loaded box never makes it a
// flake.
const AWAY_MS = (IDLE_S + 9) * 1000
// The room's own idle span, past every wait above, so only the last walk
// outlasts it, the front's tick checking it every seven seconds.
const ROOM_IDLE_S = 30

// A click in the shell, as a visitor's next one after a pause: the first
// link its navigation holds to a page other than this one, followed by
// the client's own router, so its queries are what the server answers.
async function click(page) {
  const here = new URL(page.url()).pathname
  const links = page.locator('nav a[href^="/"]:visible')
  const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  const href = hrefs.find((h) => h && h !== here && !h.startsWith('/_demo') && !h.startsWith('/sign-in'))
  assert.ok(href, `no link to click on ${page.url()}: ${hrefs.join(', ')}`)
  await page.locator(`nav a[href="${href}"]:visible`).first().click()
  return href
}

// What the page shows a few seconds after a click: the URL it settled
// on and its text, so a failure says what the visitor saw.
async function settled(page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  return { url: new URL(page.url()), text: (await page.locator('body').innerText().catch(() => '')) ?? '' }
}

async function main() {
  const socketDir = startCluster()
  buildTemplate(socketDir)
  const browser = await chromium.launch()
  cleanups.push(() => browser.close())
  const front = await startFront(socketDir, PORT, ['--cap', '2', '--room-browsers', '4', '--idle', String(ROOM_IDLE_S), '--lifetime', '300', '--evict-after', '300', '--min-age', '300', '--browser-idle', String(IDLE_S), '--per-address', '5'])
  const hugo = 'hugo@lanterne.example'

  log('walk 1: Hugo, alone in his room, goes idle past --browser-idle and clicks…')
  const { page: p1 } = await freshRoom(browser, FRONT)
  const code = await inviteCode(p1)
  await signIn(p1, hugo)
  // What the front and the room answer each request the walk makes, so
  // a failure says which one turned the visitor away.
  p1.on('response', (r) => {
    const u = new URL(r.url())
    if (!u.pathname.startsWith('/_app/immutable')) {
      log(`  hugo ${r.request().method()} ${u.pathname} ${r.status()} ${r.headers()['content-type'] ?? ''}`)
    }
  })
  await sleep(AWAY_MS)
  const href = await click(p1)
  await p1.waitForURL((u) => u.pathname === href, { timeout: 20_000 }).catch(() => {})
  const one = await settled(p1)
  assert.doesNotMatch(one.text, /Loading demo environment|copy was reset|Something broke/, `after the pause, Hugo sees a fresh copy or an error, at ${one.url}:\n${one.text.slice(0, 400)}`)
  assert.equal(one.url.pathname, href, `after the pause, Hugo's click lands on ${one.url} rather than ${href}`)
  assert.equal(await inviteCode(p1), code, 'after the pause, Hugo is in another room')
  log(`ok: back from the pause, Hugo's click lands on ${href}, still signed in, in the same room`)

  log('walk 1b: Hugo goes idle again and reloads the page…')
  await sleep(AWAY_MS)
  await p1.reload()
  const reloaded = await settled(p1)
  assert.doesNotMatch(reloaded.text, /Loading demo environment|copy was reset|Something broke/, `after the pause, Hugo's reload shows a fresh copy or an error, at ${reloaded.url}:\n${reloaded.text.slice(0, 400)}`)
  assert.equal(reloaded.url.pathname, href, `after the pause, Hugo's reload lands on ${reloaded.url} rather than ${href}`)
  assert.equal(await inviteCode(p1), code, 'after the pause, Hugo’s reload puts him in another room')
  log(`ok: back from the pause, Hugo's reload shows ${href} again, in the same room`)

  log('walk 2: Hugo goes idle again; Inès joins his room and signs in as Hugo, freed; then Hugo clicks…')
  await sleep(AWAY_MS)
  const { page: p2 } = await joinRoom(browser, FRONT, code)
  assert.ok(!(await isTaken(fixtureButton(p2, hugo))), 'Hugo, idle past --browser-idle, still reads taken to Inès')
  await signIn(p2, hugo)
  await click(p1)
  await p1.waitForURL((u) => u.pathname === '/sign-in', { timeout: 20_000 }).catch(() => {})
  const two = await settled(p1)
  assert.equal(two.url.pathname, '/sign-in', `Hugo, his member taken, lands on ${two.url} rather than the sign-in:\n${two.text.slice(0, 400)}`)
  assert.match(two.text, new RegExp(`You were away a while, so ${NAME[hugo]} was freed for others`), `the sign-in says nothing of why:\n${two.text.slice(0, 400)}`)
  assert.ok(await isTaken(fixtureButton(p1, hugo)), 'Hugo, now Inès’s, does not read taken to his old browser')
  assert.equal(await inviteCode(p1), code, 'Hugo’s browser, its member taken, is put in another room')
  log('ok: his member taken, Hugo lands on the sign-in of the same room, which says he was freed for others')

  log('walk 3: the sentence is the server’s, never the link’s: a crafted ?away= says nothing…')
  const { page: p3 } = await joinRoom(browser, FRONT, code)
  await p3.goto(`${FRONT}/sign-in?away=${encodeURIComponent(hugo)}`)
  const three = await settled(p3)
  assert.doesNotMatch(three.text, /You were away a while/, 'a crafted ?away= shows the sentence')
  log('ok: a crafted link shows no notice')

  log('walk 4: everyone goes idle past the room’s own --idle, so it ends; then Inès, signed in as Hugo, clicks…')
  const shown = []
  p2.on('response', async (r) => {
    if (r.request().isNavigationRequest() && r.status() === 200) {
      shown.push(await r.text().catch(() => ''))
    }
  })
  await sleep((ROOM_IDLE_S + 20) * 1000)
  await click(p2)
  await p2.waitForURL((u) => u.pathname === '/sign-in', { timeout: 90_000 })
  const four = await settled(p2)
  assert.ok(shown.some((t) => t.includes('Your earlier copy was reset.')), 'the loading page never said the copy was reset')
  assert.doesNotMatch(four.text, /Something broke/)
  assert.notEqual(await inviteCode(p2), code, 'Inès is back in the ended room')
  log('ok: her room ended, Inès’s click lands on the loading page, which says so, then on a fresh copy’s sign-in')
  await front.stop()
}

main()
  .then(() => stop(0))
  .catch((e) => {
    log(`FAILED: ${e.stack ?? e.message}`)
    stop(1)
  })
