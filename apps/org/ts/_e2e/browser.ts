// Real browsers against the built shell, for the scenarios that drive the
// editor as a person does: the shell's server in dev mode on a free port,
// and Playwright's Chromium, Firefox and WebKit from nixpkgs'
// playwright-driver.browsers, which playwright-core's version matches and
// the devshell and `cella` export as PLAYWRIGHT_BROWSERS_PATH.
// `BROWSERS` (comma-separated) narrows the browsers run. A scenario drives
// its browsers at once, each in a context of its own, against the one
// server `serve` shares among them; one whose browsers would meet in what
// they write says why in a line `// browsers: one at a time: <why>`, and
// the run, which prints it, sets `CELLA_BROWSERS_APART`, so they run one
// after another.

import { describe } from 'node:test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, firefox, webkit, type Browser, type BrowserContext } from 'playwright-core'

const entry = new URL('../build/index.js', import.meta.url).pathname

// Firefox makes its profile root under the home and sandboxes its content
// processes with chroot, and a turn on the box has a read-only home and a
// syscall filter that refuses chroot. So it gets a home of its own under
// the temporary directory, dropped when it closes, and no content sandbox,
// as Playwright runs Chromium without its own. Its contexts share one
// profile's form history, so what one scenario's person typed would be
// offered under another's fields, and the open list takes the next click
// to close itself; it keeps none, so each context starts as a fresh
// browser does.
async function firefoxLaunch(): Promise<Browser> {
  const home = mkdtempSync(join(tmpdir(), 'cella-firefox-'))
  const browser = await firefox.launch({
    env: { ...process.env, HOME: home, MOZ_DISABLE_CONTENT_SANDBOX: '1' },
    firefoxUserPrefs: { 'browser.formfill.enable': false },
  })
  browser.once('disconnected', () => rmSync(home, { recursive: true, force: true }))
  return browser
}

const engines: Record<string, () => Promise<Browser>> = {
  chromium: () => chromium.launch(),
  firefox: firefoxLaunch,
  webkit: () => webkit.launch(),
}

// The browsers run, each by its name and how it launches.
export function browsers(): [string, () => Promise<Browser>][] {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    throw new Error('PLAYWRIGHT_BROWSERS_PATH is not set: run the scenarios through `cella test`, inside `nix develop`')
  }
  const wanted = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',')
  return Object.entries(engines).filter(([name]) => wanted.includes(name))
}

// Whether this scenario's browsers run one after another, as its file's
// `// browsers: one at a time` line asks.
const apart = () => process.env.CELLA_BROWSERS_APART === '1'

// Each browser's tests, which `register` declares for the browser it is
// handed: the browsers' at once, each browser's own in their order.
export function eachBrowser(register: (name: string, launch: () => Promise<Browser>) => void) {
  describe('in each browser', { concurrency: apart() ? 1 : true }, () => {
    for (const [name, launch] of browsers()) describe(name, { concurrency: 1 }, () => register(name, launch))
  })
}

// `drive` in each browser, at once, within one test: every browser runs to
// its end, and the test fails with what failed, named by its browser.
export async function inBrowsers(drive: (name: string, launch: () => Promise<Browser>) => Promise<void>) {
  const all = browsers()
  if (apart()) {
    for (const [name, launch] of all) await drive(name, launch)
    return
  }
  const ran = await Promise.allSettled(all.map(([name, launch]) => drive(name, launch)))
  const failed = ran.flatMap((r, i) => (r.status === 'rejected' ? [[all[i][0], r.reason] as const] : []))
  if (failed.length === 1) throw failed[0][1]
  if (failed.length > 1) {
    throw new AggregateError(
      failed.map(([, e]) => e),
      failed.map(([name, e]) => `${name}: ${e instanceof Error ? e.message : String(e)}`).join('\n'),
    )
  }
}

// A port free on localhost now.
export const free = () =>
  new Promise<number>((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })

type Served = { base: string; stop: () => Promise<void> }

// The server the browsers running now share, and how many hold it.
let shared: { started: Promise<Served>; holders: number } | undefined

// The built shell in dev mode, whose sign-in page offers the fixture
// members: one server for the browsers that ask while it runs, stopped
// when the last of them stops it.
export async function serve(): Promise<Served> {
  if (!shared) shared = { started: start(), holders: 0 }
  const held = shared
  held.holders++
  const { base, stop } = await held.started
  let stopped = false
  return {
    base,
    stop: async () => {
      if (stopped) return
      stopped = true
      if (--held.holders > 0) return
      if (shared === held) shared = undefined
      await stop()
    },
  }
}

async function start(): Promise<Served> {
  const port = await free()
  const base = `http://127.0.0.1:${port}`
  // adapter-node takes the origin to be https unless a proxy's header says
  // otherwise; the browsers send it, as a proxy in front would.
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', PROTOCOL_HEADER: 'x-forwarded-proto', CELLA_DEV: '1' }
  delete env.DATABASE_URL
  const server: ChildProcess = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'ignore', 'inherit'] })
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${base}/search`)
      break
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  return {
    base,
    stop: async () => {
      if (server.exitCode === null) {
        const exited = new Promise((r) => server.once('exit', r))
        server.kill('SIGKILL')
        await exited
      }
    },
  }
}

// Signs a browser in as a fixture member, as the dev server's sign-in page
// offers: the page derives the member's TEST-ONLY device key, keeps it in
// this browser and signs the server's challenge with it, and the
// session's cookie is the context's from then on; every write its pages
// post, this browser signs.
export async function signIn(context: BrowserContext, base: string, actor: string) {
  const page = await context.newPage()
  try {
    await page.goto(`${base}/sign-in`)
    await page.getByTitle(actor).click()
    await page.waitForURL(`${base}/inbox`)
  } finally {
    await page.close()
  }
}
