// tools/qa/record-timing.mjs: how long a record page's own API calls take,
// at production's numbers (`--cap 5 --room-browsers 4`), the operator's
// complaint (17 Nov) that opening a record is slow "at least sometimes"
// while a view opens fast. A throwaway Postgres cluster and one demo
// front, as tools/qa/rooms.mjs stands up, never against production.
//
//   nix develop -c node tools/qa/record-timing.mjs
//
// RECORD_FRONT_PORT picks the front's own port (default 31020, loopback
// only). Opens 3-4 record kinds (tasks, which keep a body, and whichever
// of contacts, bills and documents the template holds a row of), each
// cold (first open after sign-in) and warm (the second), alone in the
// room and with three other browsers busy in it, logging every request
// the record page's own script makes (`/_app/remote/…`, `body/live`,
// `content`), its time to a first response. Prints median and max per
// endpoint, and the time to the record being usable (its title shown,
// and, for a body, its editor ready).

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const repo = new URL('../../', import.meta.url).pathname
const PORT = Number(process.env.RECORD_FRONT_PORT ?? 31020)
const FRONT = `http://127.0.0.1:${PORT}`
const log = (line) => console.log(`record-timing: ${line}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const NAME = {
  'camille@lanterne.example': 'Camille Martin',
  'lea@lanterne.example': 'Léa Bernard',
  'thomas@lanterne.example': 'Thomas Nguyen',
  'amina@lanterne.example': 'Amina Diallo',
}

const cleanups = []
const teardown = async () => {
  while (cleanups.length) {
    const fn = cleanups.pop()
    try {
      await fn()
    } catch (e) {
      log(`teardown step failed, continuing: ${e.message}`)
    }
  }
}
let tearingDown = false
const stop = async (code) => {
  if (tearingDown) return
  tearingDown = true
  await teardown()
  process.exit(code)
}
process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

// --- a throwaway Postgres cluster and the demo front, as tools/qa/rooms.mjs
// stands them up (copied, trimmed to the one front this needs). ----------

function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), 'cella-record-timing-'))
  const pgdir = join(dir, 'pg')
  const conf = readFileSync(join(repo, '.data/pg/cella.conf'), 'utf8')
  const loads = conf
    .split('\n')
    .filter((l) => /^(extension_control_path|dynamic_library_path|shared_preload_libraries) /.test(l))
  if (loads.length < 3) {
    throw new Error('.data/pg/cella.conf names no extension to load; run `cella db start` once first')
  }
  execFileSync('initdb', ['-D', pgdir, '-U', 'postgres', '--auth=trust'], { stdio: 'ignore' })
  const lines = [
    "listen_addresses = ''",
    `unix_socket_directories = '${dir}'`,
    'port = 5432',
    ...loads,
    `cella.key_file = '${join(repo, '.data/notary.key')}'`,
    `cella.vault_key_file = '${join(repo, '.data/vault.key')}'`,
    '',
  ]
  writeFileSync(join(pgdir, 'postgresql.conf'), lines.join('\n'), { flag: 'a' })
  execFileSync('pg_ctl', ['-D', pgdir, '-l', join(dir, 'pg.log'), '-w', 'start'], { stdio: 'ignore' })
  cleanups.push(() => {
    execFileSync('pg_ctl', ['-D', pgdir, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' })
    rmSync(dir, { recursive: true, force: true })
  })
  log(`a throwaway Postgres cluster is up on its own socket, ${dir}`)
  return dir
}

function buildTemplate(socketDir) {
  const url = `postgresql://postgres@/demo_template?host=${encodeURIComponent(socketDir)}`
  log('building the demo template (authority-walk story on Lanterne)…')
  execFileSync('cella', ['demo', 'template', '--url', url, '--scenario', 'authority-walk'], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] })
  log('the template is built')
}

async function startFront(socketDir, port, flags) {
  const base = `http://127.0.0.1:${port}`
  const child = spawn('cella', ['demo', 'serve', '--template', 'demo_template', '--server', join(repo, 'apps/org/ts/build'), '--port', String(port), '--host', '127.0.0.1', ...flags], {
    cwd: repo,
    env: { ...process.env, PGHOST: socketDir, PGUSER: 'postgres', PGDATABASE: 'postgres' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  const tag = (d) => {
    const s = d.toString()
    out += s
    for (const line of s.split('\n').filter(Boolean)) log(`[${port}] ${line}`)
  }
  child.stdout.on('data', tag)
  child.stderr.on('data', tag)
  const exited = new Promise((_, reject) =>
    child.once('exit', (code, signal) => reject(new Error(`the front on ${port} exited (${signal ?? code}) before it answered:\n${out}`))),
  )
  const stopFront = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const gone = new Promise((r) => child.once('exit', r))
      child.kill('SIGTERM')
      const late = setTimeout(() => child.kill('SIGKILL'), 10_000)
      await gone
      clearTimeout(late)
    }
  }
  cleanups.push(stopFront)
  const ready = (async () => {
    for (let i = 0; i < 150; i++) {
      try {
        const res = await fetch(`${base}/_demo/health`)
        if (res.ok) return
      } catch {
        // not listening yet
      }
      await sleep(200)
    }
    throw new Error(`the front on ${port} never answered its health check`)
  })()
  await Promise.race([ready, exited])
  log(`the front is up on ${base}`)
  return { stop: stopFront }
}

// --- driving a front as a browser does, as tools/qa/rooms.mjs does ------

async function retrying(fn, times = 3) {
  for (let i = 1; i < times; i++) {
    try {
      return await fn()
    } catch (e) {
      log(`attempt ${i} failed, retrying: ${e.message.split('\n')[0]}`)
    }
  }
  return await fn()
}

async function freshRoom(browser, front) {
  return retrying(async () => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(front)
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 90_000 })
      return { context, page }
    } catch (e) {
      await context.close().catch(() => {})
      throw e
    }
  })
}

async function joinRoom(browser, front, code) {
  return retrying(async () => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(`${front}/_demo/join#${code}`)
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 20_000 })
      return { context, page }
    } catch (e) {
      await context.close().catch(() => {})
      throw e
    }
  })
}

async function inviteCode(page) {
  const href = await page.getByRole('link', { name: /Copy invite|Copied/ }).getAttribute('href')
  const code = href?.split('#')[1]
  if (!code) throw new Error(`no join code on ${page.url()}`)
  return code
}

function fixtureButton(page, address) {
  return page.getByRole('button', { name: new RegExp(NAME[address]) })
}

async function signIn(page, address) {
  await fixtureButton(page, address).click()
  await page.waitForURL((u) => u.pathname === '/inbox', { timeout: 20_000 })
}

// --- finding a few record kinds to open ----------------------------------

// The first row a collection's own list page links to, by the href its
// Link draws (`/<collection>/<id>`); none where the template holds no row
// of that kind, or the page never shows one within the wait.
async function firstId(page, name) {
  await page.goto(`${FRONT}/${name}`)
  const link = page.locator(`a[href^="/${name}/"]`).first()
  try {
    await link.waitFor({ timeout: 10_000 })
    const href = await link.getAttribute('href')
    return decodeURIComponent(href?.slice(`/${name}/`.length) ?? '')
  } catch {
    return null
  }
}

// --- timing a record's own requests ---------------------------------------

// Every request the record page's own script makes once it has navigated:
// its remote query (`/_app/remote/…`, the one call `item.remote.ts`
// serves, everything the page shows), the body's live session
// (`body/live`) and a file's bytes (`content`); never the document, a
// script or a style, which a view loads too and this is not about.
// Timed to the response's own headers, not a stream's end, so a body's
// live session (left open for the rest of the page's life) times its
// first byte, not how long the browser happened to keep it open.
function track(page, into) {
  const starts = new Map()
  page.on('request', (req) => starts.set(req, Date.now()))
  page.on('response', (res) => {
    const req = res.request()
    const url = req.url()
    if (!url.startsWith(FRONT)) return
    const path = url.slice(FRONT.length)
    let label
    // Only the record page's own calls: its `item` query, a body's live
    // session, a file's bytes. Never `shell`'s `prove` (a device's
    // sign-in proof, posted back in the background, sometimes long
    // after the page it happens to land on moved on) nor `collection`
    // (the list page this script clicks back through), both another
    // page's noise, not this one's.
    if (/\/_app\/remote\/[^/]+\/item(?:[/?]|$)/.test(path)) label = 'remote item'
    else if (path.includes('/body/live')) label = 'body/live'
    else if (path.endsWith('/content')) label = 'content'
    else return
    const begun = starts.get(req)
    if (begun == null) return
    into.push({ label, ms: Date.now() - begun, status: res.status() })
  })
}

// A record is opened as a member really does: a click from its
// collection's list, which SvelteKit's router takes over client-side
// (`goto`, never a full reload), the one path that fires the page's own
// `/_app/remote/…` call rather than folding it into a freshly rendered
// document. `page.goto` straight to a record's URL, used for the very
// first open of this run, is the one exception: the record's own first
// load, server-rendered whole.
async function clickInto(page, name, id) {
  const row = page.locator(`a[href="/${name}/${encodeURIComponent(id)}"]`).first()
  await row.waitFor({ timeout: 10_000 })
  await row.click()
}

async function backToList(page, name) {
  const link = page.locator(`a[href="/${name}"]`).first()
  await link.waitFor({ timeout: 10_000 })
  await link.click()
  await page.locator(`a[href^="/${name}/"]`).first().waitFor({ timeout: 10_000 })
}

// Two moments for a record with a body: `paint`, once its canonical form
// (read through the slice's own query, server-rendered, no load) shows,
// never waiting on the live session; and `total`, once the live session
// has joined and, writable, handed the editor over — the Loro doc
// hydrated and the stream open, as the record's architecture now is
// (arrives rendered, hydrates after). A record with no body has only
// `total`, once its title shows. `nav` is how to reach the record: a
// click from its list (client-side, what a member really does) or a
// straight `goto` (a fresh load, for the very first open of a run).
async function openRecord(page, name, id, hasBody, nav) {
  const begun = Date.now()
  await nav()
  await page.locator('h1.record').waitFor({ timeout: 20_000 })
  let paint = null
  if (hasBody) {
    await page.locator('main [role=document]').first().waitFor({ timeout: 20_000 })
    paint = Date.now() - begun
    // The live-hydrated editor, by the one element every feat's body
    // shares (core body's `Editor`, `[data-editor]` over a
    // `contenteditable`), never a feat's own attribute, so task's,
    // project's and a document's draft all read the same way. A
    // generated document is read-only, never hydrated to an editor, so
    // this waits only briefly for it and falls back to the paint time.
    await page
      .locator('[data-editor] [contenteditable=true]')
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(() => log(`${name}/${id} never hydrated an editor (read-only or generated); using its paint time`))
  }
  return { total: Date.now() - begun, paint }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

async function main() {
  const socketDir = startCluster()
  buildTemplate(socketDir)
  const front = await startFront(socketDir, PORT, ['--cap', '5', '--room-browsers', '4'])
  const browser = await chromium.launch()
  cleanups.push(() => browser.close())

  log('phase 1: one browser makes a room and signs in, at production’s own numbers (--cap 5 --room-browsers 4)…')
  const { context: c0, page: p0 } = await freshRoom(browser, FRONT)
  cleanups.push(() => c0.close())
  const code = await inviteCode(p0)
  await signIn(p0, 'camille@lanterne.example')

  // Record kinds: tasks (known to keep a body, t-4), then whichever of
  // contacts, bills and documents the template holds a row of, its id
  // found from its own list page. Four kinds if the template holds one
  // of each, three or fewer otherwise; never fewer than tasks alone.
  const kinds = [{ name: 'tasks', id: 't-4', body: true }]
  for (const name of ['contacts', 'bills', 'documents']) {
    const id = await firstId(p0, name)
    if (id) kinds.push({ name, id, body: name === 'documents' })
    else log(`no row found for ${name}; left out of this run`)
  }
  log(`record kinds this run: ${kinds.map((k) => `${k.name}/${k.id}`).join(', ')}`)

  p0.on('pageerror', (e) => log(`page error: ${e.message}`))
  p0.on('console', (m) => {
    if (m.type() === 'error') log(`console error: ${m.text()}`)
  })

  const results = []
  const timings = []
  track(p0, timings)

  const timed = async (scenario, k, nav) => {
    timings.length = 0
    const { total, paint } = await openRecord(p0, k.name, k.id, k.body, nav)
    for (const t of timings) results.push({ scenario, label: `${k.name}: ${t.label}`, ms: t.ms })
    if (paint != null) results.push({ scenario, label: `${k.name}: body first paint`, ms: paint })
    results.push({ scenario, label: `${k.name}: usable`, ms: total })
  }

  // Cold: this run's very first open of the kind, straight from a `goto`
  // (a fresh load, as a shared link or a reload gives). Warm: a second
  // open, by clicking back to the list and into the same record again,
  // client-side, as the rest of a session's opens are.
  log('phase 2: alone in the room, each kind cold (first open, a fresh load) then warm, three times over (clicked from its list)…')
  for (const k of kinds) {
    await timed('alone/cold', k, () => p0.goto(`${FRONT}/${k.name}/${encodeURIComponent(k.id)}`))
    for (let i = 0; i < 3; i++) {
      await backToList(p0, k.name)
      await timed('alone/warm', k, () => clickInto(p0, k.name, k.id))
    }
  }

  log('phase 3: three more browsers join and keep the room busy, opening and writing…')
  const busyPeople = []
  for (const addr of ['lea@lanterne.example', 'thomas@lanterne.example', 'amina@lanterne.example']) {
    const { context, page } = await joinRoom(browser, FRONT, code)
    await signIn(page, addr)
    busyPeople.push({ context, page })
  }
  let busyStop = false
  const editorOf = (page) => page.locator('[data-editor]').locator('[contenteditable=true]').first()
  const busyLoop = async (page, k, write) => {
    while (!busyStop) {
      await page.goto(`${FRONT}/${k.name}/${encodeURIComponent(k.id)}`).catch(() => {})
      await page.locator('h1.record').waitFor({ timeout: 20_000 }).catch(() => {})
      if (write && k.body) {
        await page.locator('[data-editor] [contenteditable=true]').first().waitFor({ timeout: 20_000 }).catch(() => {})
        await editorOf(page)
          .click({ timeout: 2_000 })
          .then(() => page.keyboard.type('busy room, writing '))
          .catch(() => {})
      }
      await sleep(150)
    }
  }
  const busyTasks = busyPeople.map((p, i) => busyLoop(p.page, kinds[i % kinds.length], i === 0))

  for (const k of kinds) {
    await p0.goto(`${FRONT}/${k.name}`)
    await timed('busy/cold', k, () => clickInto(p0, k.name, k.id))
    for (let i = 0; i < 3; i++) {
      await backToList(p0, k.name)
      await timed('busy/warm', k, () => clickInto(p0, k.name, k.id))
    }
  }
  busyStop = true
  await sleep(300)
  await Promise.allSettled(busyTasks)
  for (const p of busyPeople) await p.context.close().catch(() => {})

  await front.stop()
  cleanups.splice(cleanups.indexOf(front.stop), 1)

  // --- the table -------------------------------------------------------
  const groups = new Map()
  for (const r of results) {
    const key = `${r.scenario}\t${r.label}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r.ms)
  }
  console.log('')
  console.log('record-timing: numbers (ms), production’s own cap (--cap 5 --room-browsers 4)')
  console.log('scenario\tendpoint\tmedian\tmax\tn')
  for (const [key, xs] of groups) {
    console.log(`${key}\t${median(xs)}\t${Math.max(...xs)}\t${xs.length}`)
  }
}

main()
  .then(() => stop(0))
  .catch((e) => {
    console.error(`record-timing: FAILED: ${e.stack ?? e.message}`)
    stop(1)
  })
