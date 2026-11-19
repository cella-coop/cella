// tools/qa/front.mjs: what the demo front's manual QA runs share
// (`rooms.mjs`, `idle.mjs`): a throwaway Postgres cluster on a private
// socket, the demo template built in it, `cella demo serve` fronts on
// loopback ports, and a browser driving one as a visitor does, all torn
// down when the run ends, pass or fail. Never against production.

import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const repo = new URL('../../', import.meta.url).pathname
let tag = 'qa'
// Names the run in every line it logs, as `rooms qa: …`.
export function named(name) {
  tag = name
}
export const log = (line) => console.log(`${tag}: ${line}`)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))


// The fixture members a run signs in as, by address, and the name the
// sign-in page shows: every one of Lanterne's that holds an enrolled
// device at the authority-walk scenario's date (queried once by hand;
// Paul holds none at this date, so he is left out).
export const NAME = {
  'camille@lanterne.example': 'Camille Martin',
  'lea@lanterne.example': 'Léa Bernard',
  'thomas@lanterne.example': 'Thomas Nguyen',
  'amina@lanterne.example': 'Amina Diallo',
  'ines@lanterne.example': 'Inès Haddad',
  'julien@lanterne.example': 'Julien Petit',
  'yusuf@lanterne.example': 'Yusuf Demir',
  'chloe@lanterne.example': 'Chloé Moreau',
  'malik@lanterne.example': 'Malik Benali',
  'sofia@lanterne.example': 'Sofia Rossi',
  'hugo@lanterne.example': 'Hugo Lefèvre',
}

export const cleanups = []
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
export const stop = async (code) => {
  if (tearingDown) return
  tearingDown = true
  await teardown()
  process.exit(code)
}
process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

// --- a throwaway Postgres cluster, as apps/org/ts/_e2e/cluster.ts makes
// one for a scenario: a private Unix socket, never a TCP port, so "port
// 5432" below names only that socket's filename, not a host-wide bind.
export function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), 'cella-rooms-qa-'))
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

export function buildTemplate(socketDir) {
  const url = `postgresql://postgres@/demo_template?host=${encodeURIComponent(socketDir)}`
  log('building the demo template (authority-walk story on Lanterne)…')
  execFileSync('cella', ['demo', 'template', '--url', url, '--scenario', 'authority-walk'], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] })
  log('the template is built')
}

// Starts `cella demo serve` on `port` against the cluster at `socketDir`,
// waits until it answers its health check, and returns its pid and a
// function that stops it (SIGTERM, which ends every room it holds and
// drops their databases, then exits). Registered on the global teardown
// too, so a run that fails partway still stops it.
export async function startFront(socketDir, port, flags) {
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
  // `child.pid` is usually demo-serve.mjs's own: `cella`, then `cargo
  // run`, each execs the next in place rather than forking, so the PID
  // holds across the chain once the binary is already built. The one
  // case that differs is an unbuilt binary, where `cargo run` builds it
  // first and only then execs; found here by its command line instead,
  // so the numbers below (each room's own server, by --ppid) are never
  // read off the wrong process either way.
  let pid = child.pid
  try {
    const found = execFileSync('pgrep', ['-f', `tools/demo-serve.mjs .*--port ${port}(\\b|$)`], { encoding: 'utf8' }).trim().split('\n')[0]
    if (found) pid = Number(found)
  } catch {
    // pgrep exits 1 with nothing found; child.pid is right already then.
  }
  log(`the front is up on ${base}, pid ${pid}`)
  return { pid, stop: stopFront }
}

// --- driving a front as a browser does ------------------------------------

// This box runs other work besides this script; a navigation that times
// out once, rather than something genuinely refused, is retried once
// with a fresh context before this gives up on it.
export async function retrying(fn, times = 3) {
  for (let i = 1; i < times; i++) {
    try {
      return await fn()
    } catch (e) {
      log(`attempt ${i} failed, retrying: ${e.message.split('\n')[0]}`)
    }
  }
  return await fn()
}

export async function freshRoom(browser, front) {
  return retrying(async () => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(front)
      // A fresh room means a database copy and a server of its own made
      // from nothing; the front's own `answers()` allows the copy's
      // server up to 60 s to answer at all, so this client-side wait
      // sits safely above that, generous again for a box running other
      // work besides.
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 90_000 })
      return { context, page }
    } catch (e) {
      // A failed attempt's own page keeps polling /_demo/start forever
      // otherwise, one contending attempt a retry never needed.
      await context.close().catch(() => {})
      throw e
    }
  })
}

export async function joinRoom(browser, front, code) {
  return retrying(async () => {
    const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(`${front}/_demo/join#${code}`)
      // A join touches no database; normally under a second. Short on
      // purpose, so a join truly refused (room full) fails fast rather
      // than sitting out a long timeout, as it would never navigate on.
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 20_000 })
      return { context, page }
    } catch (e) {
      await context.close().catch(() => {})
      throw e
    }
  })
}

// A refused join, past the room's own cap: the join page's script posts
// the code and shows the front's own plain-text refusal in `#state`,
// never navigating anywhere.
export async function joinRefused(browser, front, code) {
  const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
  const page = await context.newPage()
  await page.goto(`${front}/_demo/join#${code}`)
  await page.waitForFunction(() => document.getElementById('state')?.textContent?.trim().length > 0, undefined, { timeout: 30_000 }).catch((e) => {
    log(`a join expected to be refused never showed its #state; url now ${page.url()}`)
    throw e
  })
  const text = await page.locator('#state').textContent()
  await context.close()
  return text ?? ''
}

// The room's own Copy invite link, read from the banner rather than
// clicked: its href carries the join code in the fragment, which this
// reads directly, as `invite.copy` does from `location.hash` on the far
// side.
export async function inviteCode(page) {
  const href = await page.getByRole('link', { name: /Copy invite|Copied/ }).getAttribute('href')
  const code = href?.split('#')[1]
  if (!code) throw new Error(`no join code on ${page.url()}`)
  return code
}

export function fixtureButton(page, address) {
  return page.getByRole('button', { name: new RegExp(NAME[address]) })
}

// Whether a fixture button reads taken, by its title (SignIn.svelte:
// "<address>: signed in on another browser already"), the server's own
// truth; `.isDisabled()` is not used for this, since Button also sets
// `aria-disabled` from an unrelated busy flag, which can read true for a
// moment with nothing to do with a lease.
export async function isTaken(button) {
  return /signed in on another browser already/.test((await button.getAttribute('title')) ?? '')
}

export async function signIn(page, address) {
  const begun = Date.now()
  await fixtureButton(page, address).click()
  await page.waitForURL((u) => u.pathname === '/inbox', { timeout: 20_000 })
  return Date.now() - begun
}

