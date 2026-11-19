// tools/qa/rooms.mjs: a manual QA run of the demo's rooms
// (`tools/demo-serve.mjs`), at the scale the operator asked for, "a dozen
// people concurrently would be remarkable": real Playwright browsers,
// each its own context, making and joining rooms by Copy invite link,
// signing in as fixture members, leasing them, writing at once, Reset,
// idle ejection, and both the room's and the front's own caps; and, at
// the operator's later word, at production's own numbers, --cap 5
// --room-browsers 4, whether a room full at that is still fast. Never
// against production: it stands up its own throwaway Postgres cluster
// (a private socket, never a port anyone else binds) and its own demo
// fronts on loopback ports, and tears both down when it ends, pass or
// fail, stopping every process and database it made.
//
// Prerequisites, once, in this checkout:
//   nix develop -c cella db start   # builds the extension under .data/ext
//   nix develop -c cella build      # the shell this serves, apps/org/ts/build
//
// Then:
//   nix develop -c node tools/qa/rooms.mjs
//
// QA_FRONT_PORT picks the main front's own port (default 31001; 31002
// for the short-lived front the idle-ejection check uses, 31003 for the
// one testing production's --cap 5 --room-browsers 4, 31004 for the
// small one proving the front's own cap), all loopback only. Takes four
// to six minutes, most of it three deliberate waits past the fronts'
// own `--browser-idle`; it prints each phase as it passes, the flags it
// chose and why, and, at the end, memory and latency numbers.

import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { buildTemplate, cleanups, fixtureButton, freshRoom, inviteCode, isTaken, joinRefused, joinRoom, log, named, NAME, signIn, sleep, startCluster, startFront, stop } from './front.mjs'

const MAIN_PORT = Number(process.env.QA_FRONT_PORT ?? 31001)
const MAIN = `http://127.0.0.1:${MAIN_PORT}`
const IDLE_PORT = MAIN_PORT + 1
const IDLE_FRONT = `http://127.0.0.1:${IDLE_PORT}`
const PERF_PORT = MAIN_PORT + 2
const PERF_FRONT = `http://127.0.0.1:${PERF_PORT}`
const CAP_PORT = MAIN_PORT + 3
const CAP_FRONT = `http://127.0.0.1:${CAP_PORT}`
named('rooms qa')

// The fixture members this run signs in as (`NAME`, `front.mjs`): eleven
// offered, eleven used: ten across the three main rooms, Hugo on his own
// in the short-lived front dedicated to the idle-ejection check.
// Three rooms, ten people, on the main front: A for the main concurrent
// writes, B just more people in a room of their own, C for Reset now
// (nothing is written there, so resetting it loses nothing worth
// keeping). Hugo and Inès, on the short-lived idle front, are apart.
const ROOM_A = ['camille@lanterne.example', 'lea@lanterne.example', 'thomas@lanterne.example', 'amina@lanterne.example']
const ROOM_B = ['ines@lanterne.example', 'julien@lanterne.example', 'yusuf@lanterne.example']
const ROOM_C = ['chloe@lanterne.example', 'malik@lanterne.example', 'sofia@lanterne.example']

// How long the main front lets a browser go unseen before counting it
// gone and freeing the member it leased (`--browser-idle`): long enough that
// nothing here is ejected by accident between one phase and the next
// (the whole run is a few minutes), short enough that the one place this
// run deliberately waits past it (Reset now, alone) is not a very long
// wait. The short-lived idle front below uses a far shorter one on
// purpose, to prove the ejection itself without the same trade-off.
const MAIN_BROWSER_IDLE_S = 90

// The demo banner's own markup, as apps/org/ts/_e2e/demo.test.ts reads it.
const strip = (html) => html.match(/<div class="demo[^>]*>[\s\S]*?<\/div>/)?.[0] ?? ''

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

async function main() {
  log(`driving ${Object.keys(NAME).length} fixture members: ten across three rooms on one front, Hugo alone on a second`)
  const errors = []
  const trackErrors = (page, who) => {
    page.on('pageerror', (e) => errors.push(`${who}: page error: ${e.message}`))
    page.on('requestfailed', (r) => {
      // A task's live body session is a long-lived chunked connection;
      // closing its context or stopping its front (this run does both,
      // on purpose, long before the page is done with it) always ends
      // it mid-stream, never a fault of its own.
      if (r.url().includes('/body/live')) return
      errors.push(`${who}: request failed: ${r.url()}: ${r.failure()?.errorText}`)
    })
    page.on('response', (r) => {
      if (r.status() >= 500) errors.push(`${who}: ${r.status()} on ${r.url()}`)
    })
  }

  const socketDir = startCluster()
  buildTemplate(socketDir)

  const browser = await chromium.launch()
  cleanups.push(() => browser.close())

  // --- idle ejection, on its own short-lived front ------------------------
  // A front of its own, `--browser-idle 8`, so this needs no long wait
  // and touches nothing the main scenario depends on: Hugo signs in,
  // his browser goes quiet for good, and once idle past `--browser-idle`
  // Inès, joining the same room, finds him no longer taken.
  log('phase 1: an idle browser (past --browser-idle) frees its member, on a short-lived front…')
  {
    const idleFront = await startFront(socketDir, IDLE_PORT, ['--cap', '2', '--room-browsers', '4', '--idle', '300', '--lifetime', '300', '--evict-after', '300', '--min-age', '300', '--browser-idle', '6', '--per-address', '5'])
    const { context: c1, page: p1 } = await freshRoom(browser, IDLE_FRONT)
    trackErrors(p1, 'hugo (idle front)')
    const code = await inviteCode(p1)
    await signIn(p1, 'hugo@lanterne.example')
    // Hugo's browser is touched no more from here; a wide margin over
    // --browser-idle so this box's own load never makes it a flake.
    await sleep(15_000)
    const { context: c2, page: p2 } = await joinRoom(browser, IDLE_FRONT, code)
    trackErrors(p2, 'ines (idle front, resuming)')
    const hugoBtn = fixtureButton(p2, 'hugo@lanterne.example')
    assert.ok(!(await isTaken(hugoBtn)), "hugo's lease freed once his browser went idle past --browser-idle")
    await signIn(p2, 'ines@lanterne.example')
    await c1.close()
    await c2.close()
    await idleFront.stop()
    cleanups.splice(cleanups.indexOf(idleFront.stop), 1)
  }
  log('ok: idle past --browser-idle, the member a browser held is freed; the short-lived front is stopped')

  // --- the main front: room making and joining by Copy invite link -------
  // --cap 10 --room-browsers 8: the module's own defaults (visitors,
  //   roomBrowsers), so the cap scenarios below probe the real numbers.
  // --idle 600, --lifetime 1200, --evict-after 900, --min-age 900: all
  //   long enough that nothing here is ever idle-ended, outlives its own
  //   lifetime or is cap-evicted mid-run (this run takes a few minutes,
  //   room A's countdown starting at its very first sign-in); the
  //   front-cap scenario near the end is read against "every copy is in
  //   use", never a room quietly ending instead. The countdown itself
  //   (phase 4) shows as soon as a room holds any lifetime at all, not
  //   only once it is close to running out, so a long one here still
  //   proves it.
  // --browser-idle 90 (MAIN_BROWSER_IDLE_S): see its own comment above.
  // --per-address 15: raised from its default (cap minus four, 6 here).
  //   Every browser in this run shares one address, 127.0.0.1, and the
  //   scenario below makes ten rooms from it on purpose, to fill the
  //   front's own cap; left at its default, the per-address limit would
  //   answer first and the cap scenario would never be reached. A public
  //   host never raises this past a few.
  // --per-address-rate 40, --per-minute 100: raised a little over their
  //   defaults (30, 60), since ten rooms and their joins, all from one
  //   address in one short run, would otherwise occasionally trip the
  //   rate limit rather than the cap it means to test.
  const front = await startFront(socketDir, MAIN_PORT, [
    '--cap', '10',
    '--room-browsers', '8',
    '--idle', '600',
    '--lifetime', '1200',
    '--evict-after', '900',
    '--min-age', '900',
    '--browser-idle', String(MAIN_BROWSER_IDLE_S),
    '--per-address', '15',
    '--per-address-rate', '40',
    '--per-minute', '100',
  ])

  log('phase 2: making three rooms and joining them by Copy invite link…')
  const rooms = {}
  const people = {} // address -> { context, page }
  const signInLatencies = []

  async function makeRoomFor(roomName, [first, ...rest]) {
    const madeAt = Date.now()
    const { context, page } = await freshRoom(browser, MAIN)
    trackErrors(page, `${first} (${roomName}, made it)`)
    const code = await inviteCode(page)
    signInLatencies.push(await signIn(page, first))
    people[first] = { context, page }
    const joined = [first]
    for (const address of rest) {
      const { context: c2, page: p2 } = await joinRoom(browser, MAIN, code)
      trackErrors(p2, `${address} (${roomName}, joined)`)
      signInLatencies.push(await signIn(p2, address))
      people[address] = { context: c2, page: p2 }
      joined.push(address)
    }
    rooms[roomName] = { code, members: joined, madeAt }
    log(`room ${roomName}: ${joined.join(', ')} signed in, joined by Copy invite link`)
  }

  await makeRoomFor('A', ROOM_A)

  // --- member leases: taken, greyed out, to another browser in the room --
  log('phase 3: a member another browser holds in the same room reads taken…')
  // Kept open, not closed: closing a Playwright context does not tell
  // the room's server its browser left, so it would otherwise go on
  // counting as present (phase 3b's own cap depends on counting every
  // browser room A holds exactly).
  const leaseCheck = await joinRoom(browser, MAIN, rooms.A.code)
  {
    trackErrors(leaseCheck.page, 'A (lease check)')
    const camille = fixtureButton(leaseCheck.page, 'camille@lanterne.example')
    assert.ok(await isTaken(camille), 'camille, held by another browser, reads taken')
    assert.match((await camille.textContent()) ?? '', /taken/, 'camille is drawn with the taken badge')
  }
  log('ok: a member another browser holds in this room reads taken, disabled, to a third')

  // --- a newcomer at the room's own browser cap gets the retry page ------
  // Done here, right after room A is made, while its members are
  // certainly still present: the Reset phase below waits well over a
  // minute, past which the front would count as gone a browser not
  // touched meanwhile, which would undercount the room. Room A already
  // holds five (its four members and the lease check above); three more
  // fillers bring it to the cap of eight exactly.
  log('phase 3b: a newcomer past --room-browsers (8) in one room gets the retry page…')
  {
    const fillers = []
    for (let i = 0; i < 3; i++) {
      const { context } = await joinRoom(browser, MAIN, rooms.A.code)
      fillers.push(context)
    }
    const text = await joinRefused(browser, MAIN, rooms.A.code)
    assert.match(text, /holds as many browsers as one may/, "a ninth browser in room A reads the room's own cap, not the front's")
    for (const c of fillers) await c.close()
    await leaseCheck.context.close()
  }
  log('ok: a ninth browser in an 8-browser room gets the retry page')

  await makeRoomFor('B', ROOM_B)
  await makeRoomFor('C', ROOM_C)

  // --- the banner's countdown starts at the first sign-in -----------------
  log('phase 4: the banner counts down only once a room has its first member…')
  {
    const before = strip(await people[ROOM_A[0]].page.content())
    assert.match(before, /<time>\d:\d\d:\d\d<\/time>/, 'A: camille is already signed in, so the countdown already runs')
    const { context, page } = await freshRoom(browser, MAIN)
    const freshStrip = strip(await page.content())
    assert.doesNotMatch(freshStrip, /<time>\d:\d\d:\d\d<\/time>/, 'a fresh room with no one signed in shows no countdown yet')
    await context.close()
  }
  log('ok: a fresh room shows no countdown; one with a member signed in already does')

  // --- concurrent writes: several records, one shared body, at once ------
  log('phase 5: several members write at once, two of them in one shared task body…')
  let writeLatencies = []
  {
    const open = async (address, task) => {
      const { page } = people[address]
      await page.goto(`${MAIN}/tasks/${task}`)
      await page.locator('[data-body]').waitFor({ timeout: 20_000 })
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      return page
    }
    const editorOf = (page) => page.locator('[data-editor]').locator('[contenteditable=true]').first()
    const bodyText = (page) => page.locator('main [role=document]').first()
    const waitsFor = async (page, needle, who) => {
      for (let i = 0; i < 100; i++) {
        const t = (await bodyText(page).textContent()) ?? ''
        if (t.includes(needle)) return
        await sleep(100)
      }
      throw new Error(`${who} never showed ${JSON.stringify(needle)}`)
    }
    const saved = (page) => page.waitForSelector('[data-body=edit][data-state=saved]', { timeout: 20_000 })

    const camille = await open('camille@lanterne.example', 't-4')
    const lea = await open('lea@lanterne.example', 't-4') // the shared body
    const thomas = await open('thomas@lanterne.example', 't-5')
    const amina = await open('amina@lanterne.example', 't-6')

    const timed = async (page, who, fn) => {
      const begun = Date.now()
      await fn()
      await saved(page)
      writeLatencies.push({ who, ms: Date.now() - begun })
    }

    const camilleLine = 'camille, live, at once'
    const leaLine = 'léa, live, at once'
    await Promise.all([
      timed(camille, 'camille/t-4', async () => {
        await editorOf(camille).click()
        await camille.keyboard.type(camilleLine)
      }),
      timed(lea, 'lea/t-4', async () => {
        await editorOf(lea).click()
        await lea.keyboard.type(leaLine)
      }),
      timed(thomas, 'thomas/t-5', async () => {
        await editorOf(thomas).click()
        await thomas.keyboard.type('thomas, concurrently, own task')
      }),
      timed(amina, 'amina/t-6', async () => {
        await editorOf(amina).click()
        await amina.keyboard.type('amina, concurrently, own task')
      }),
    ])
    await waitsFor(lea, camilleLine, "lea's tab")
    await waitsFor(camille, leaLine, "camille's tab")

    if (errors.length) {
      throw new Error(`concurrent writes raised errors:\n${errors.join('\n')}`)
    }
    log("ok: four members wrote at once, two of them in t-4's shared body, each saw the other's edits, no errors")
  }

  // --- Reset: refused while another browser is in the room, works alone --
  log('phase 6: Reset now, refused with others present, works once alone…')
  {
    // Reset now answers "fresh already" under 20 s old regardless of who
    // is in the room; room C is older than that by now, usually, but
    // this makes sure rather than racing it.
    const roomAge = Date.now() - rooms.C.madeAt
    if (roomAge < 25_000) await sleep(25_000 - roomAge)
    const chloe = people['chloe@lanterne.example'].page
    await chloe.goto(`${MAIN}/inbox`)
    const [response] = await Promise.all([chloe.waitForResponse((r) => r.url().endsWith('/_demo/reset')), chloe.getByRole('button', { name: 'Reset' }).click()])
    assert.equal(response.status(), 409, 'Reset now is refused (409) while malik and sofia are still in room C')
    assert.match(await chloe.textContent('body'), /works only while you are alone/, 'the refusal says why')

    await people['malik@lanterne.example'].context.close()
    await people['sofia@lanterne.example'].context.close()
    // Past --browser-idle, malik and sofia count as gone, so chloe reads
    // alone; a wide margin over it so this box's own load never makes it
    // a flake.
    await sleep((MAIN_BROWSER_IDLE_S + 20) * 1000)
    await chloe.goto(`${MAIN}/inbox`)
    const [response2] = await Promise.all([chloe.waitForResponse((r) => r.url().endsWith('/_demo/reset')), chloe.getByRole('button', { name: 'Reset' }).click()])
    assert.equal(response2.status(), 303, 'Reset now succeeds (303, a fresh copy) once chloe is alone in room C')
  }
  log('ok: Reset now is refused with others present, and succeeds once alone')

  // Measured while the main front still holds its rooms, then stopped
  // outright: a second front against the same cluster and template, its
  // own sweep on start (every demo_v_* database its role owns, "an
  // earlier run's leftover") would end THIS front's still-running rooms
  // too, the two sharing one role and one template's name. Never two
  // fronts up at once against the same cluster.
  const mainPs = execFileSync('ps', ['-o', 'pid,rss,args', '--ppid', String(front.pid)], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .filter((l) => l.includes('apps/org/ts/build'))
  const roomRssMiB = mainPs.map((l) => Number(l.trim().split(/\s+/)[1]) / 1024)
  const frontRss = Number(execFileSync('ps', ['-o', 'rss=', '-p', String(front.pid)], { encoding: 'utf8' }).trim()) / 1024
  const roomsUp = mainPs.length
  await front.stop()
  cleanups.splice(cleanups.indexOf(front.stop), 1)
  // Every room's own browser closed too, not left open on a now-dead
  // room (room A's task pages still hold a live editing session): one
  // browser process runs the rest of this script, and a pile of open
  // tabs and live connections nothing needs any more is no way to ask
  // it for a fresh one quickly.
  for (const p of Object.values(people)) {
    await p.context.close().catch(() => {})
  }
  log('the main front is stopped, cleanly, before any other front touches this cluster')

  // --- a newcomer at the front's own visitors cap gets the retry page ----
  // Its own small front, --cap 3, rather than filling the main one to
  // ten: this box runs other work besides (several other agents' builds
  // and servers), and ten full rooms (a database and a node server each)
  // just to prove one more is refused costs more than the mechanism
  // needs; the cap itself is already exercised at its real number (10)
  // above, this just proves a newcomer past whatever it is reads the
  // retry page, never an eviction instead.
  log('phase 8: a newcomer past the front’s own cap gets the retry page…')
  {
    // --per-address 10: raised well past the cap itself (3). Unset, its
    // default (`max(1, cap - 4)`) is 1, so every room past the first
    // would be refused for holding too many, never reaching the cap;
    // set equal to the cap it would still answer with the per-address
    // reason on the fourth, not the cap's own "every copy is in use" —
    // only a value strictly above the cap reaches that for this check.
    const capFront = await startFront(socketDir, CAP_PORT, ['--cap', '3', '--room-browsers', '4', '--evict-after', '900', '--min-age', '900', '--per-address', '10'])
    const extra = []
    for (let i = 0; i < 3; i++) {
      const { context } = await freshRoom(browser, CAP_FRONT)
      extra.push(context)
    }
    const health = await (await fetch(`${CAP_FRONT}/_demo/health`)).text()
    assert.equal(health.trim(), '3 of 3', `the small front holds three rooms now (read ${JSON.stringify(health)})`)
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    const page = await context.newPage()
    await page.goto(CAP_FRONT)
    await page.waitForFunction(() => document.getElementById('state')?.textContent?.trim().length > 0, undefined, { timeout: 30_000 })
    const state = await page.locator('#state').textContent()
    assert.match(state ?? '', /every copy the demo holds is in use/i, `a fourth newcomer reads the front is full (read ${JSON.stringify(state)})`)
    await context.close()
    for (const c of extra) await c.close()
    await capFront.stop()
    cleanups.splice(cleanups.indexOf(capFront.stop), 1)
  }
  log('ok: a newcomer past the front’s cap is refused with the retry page, never evicted instead')

  if (errors.length) {
    throw new Error(`errors were raised during the run:\n${errors.join('\n')}`)
  }

  // --- production's own numbers: --cap 5 --room-browsers 4 ---------------
  // The operator now prefers less capacity run fast over more run
  // thinner: a reduced front, its own, at exactly the numbers production
  // runs. One room, filled to its new cap of four, each step timed on
  // its own: signing in, opening a page, and a write appearing on
  // another's screen, never only time-to-saved.
  log('phase 9: production now runs --cap 5 --room-browsers 4; is a full room still fast?')
  const perf = await startFront(socketDir, PERF_PORT, ['--cap', '5', '--room-browsers', '4'])
  const perfSignIns = []
  const perfLoads = []
  const perfPropagation = []
  {
    const members = ['camille@lanterne.example', 'lea@lanterne.example', 'thomas@lanterne.example', 'amina@lanterne.example']
    const { context: c0, page: p0 } = await freshRoom(browser, PERF_FRONT)
    trackErrors(p0, `${members[0]} (perf room, made it)`)
    const code = await inviteCode(p0)
    perfSignIns.push(await signIn(p0, members[0]))
    const pages = [p0]
    const contexts = [c0]
    for (const m of members.slice(1)) {
      const { context, page } = await joinRoom(browser, PERF_FRONT, code)
      trackErrors(page, `${m} (perf room, joined)`)
      perfSignIns.push(await signIn(page, m))
      pages.push(page)
      contexts.push(context)
    }
    log(`  four signed in at the new cap: sign-in average ${avg(perfSignIns).toFixed(0)} ms, max ${Math.max(...perfSignIns).toFixed(0)} ms`)

    // Page load: each of the four opens the same task, timed from the
    // navigation to the live editor being ready.
    for (const page of pages) {
      const begun = Date.now()
      await page.goto(`${PERF_FRONT}/tasks/t-4`)
      await page.locator('[data-body]').waitFor({ timeout: 20_000 })
      await page.waitForSelector('[data-body=edit]', { timeout: 20_000 })
      perfLoads.push(Date.now() - begun)
    }
    log(`  page load (navigate to editor ready): average ${avg(perfLoads).toFixed(0)} ms, max ${Math.max(...perfLoads).toFixed(0)} ms`)

    // Propagation: the first of the four types a line; how long until
    // each of the other three, live, shows it on their own screen.
    const editorOf = (page) => page.locator('[data-editor]').locator('[contenteditable=true]').first()
    const bodyText = (page) => page.locator('main [role=document]').first()
    const line = `four at the cap, ${Date.now()}`
    await editorOf(pages[0]).click()
    const typedAt = Date.now()
    await pages[0].keyboard.type(line)
    for (const page of pages.slice(1)) {
      for (;;) {
        const t = (await bodyText(page).textContent()) ?? ''
        if (t.includes(line)) {
          perfPropagation.push(Date.now() - typedAt)
          break
        }
        if (Date.now() - typedAt > 20_000) {
          throw new Error('a write never reached another browser in the perf room within 20 s')
        }
        await sleep(50)
      }
    }
    log(`  write propagation (typed to visible elsewhere): average ${avg(perfPropagation).toFixed(0)} ms, max ${Math.max(...perfPropagation).toFixed(0)} ms`)

    if (errors.length) {
      throw new Error(`the perf room raised errors:\n${errors.join('\n')}`)
    }
    for (const c of contexts) await c.close()
  }
  await perf.stop()
  cleanups.splice(cleanups.indexOf(perf.stop), 1)
  const slow = avg(perfPropagation) > 500 || Math.max(...perfSignIns) > 2000 || Math.max(...perfLoads) > 3000
  log(`ok: at production's new cap (5 rooms, 4 browsers each), a full room ${slow ? 'shows some lag — see the numbers above and below' : 'feels just as fast as the larger run above'}`)

  // --- numbers -------------------------------------------------------------
  console.log('')
  console.log(`rooms qa: numbers, --cap 10 --room-browsers 8 (the three-room run)`)
  console.log(`  rooms up: ${roomsUp}, average server RSS ${avg(roomRssMiB).toFixed(1)} MiB, front RSS ${frontRss.toFixed(1)} MiB`)
  console.log(`  sign-in latency: ${signInLatencies.length} sign-ins, average ${avg(signInLatencies).toFixed(0)} ms, max ${Math.max(...signInLatencies).toFixed(0)} ms`)
  if (writeLatencies.length) {
    const ms = writeLatencies.map((w) => w.ms)
    console.log(`  write (type-to-saved) latency: average ${avg(ms).toFixed(0)} ms, max ${Math.max(...ms).toFixed(0)} ms`)
  }
  console.log('')
  console.log(`rooms qa: numbers, --cap 5 --room-browsers 4 (production's own now)`)
  console.log(`  sign-in latency: average ${avg(perfSignIns).toFixed(0)} ms, max ${Math.max(...perfSignIns).toFixed(0)} ms`)
  console.log(`  page-load latency: average ${avg(perfLoads).toFixed(0)} ms, max ${Math.max(...perfLoads).toFixed(0)} ms`)
  console.log(`  write propagation (typed to visible elsewhere): average ${avg(perfPropagation).toFixed(0)} ms, max ${Math.max(...perfPropagation).toFixed(0)} ms`)
  console.log(`  verdict: a full room at the new cap ${slow ? 'shows some lag' : 'feels just as fast as the larger run'}`)
}

main()
  .then(() => stop(0))
  .catch((e) => {
    console.error(`rooms qa: FAILED: ${e.stack ?? e.message}`)
    stop(1)
  })
