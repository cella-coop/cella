// Real browsers against the built shell, for the scenarios that drive the
// editor as a person does: the shell's server in dev mode on a free port,
// and Playwright's Chromium, Firefox and WebKit from nixpkgs'
// playwright-driver.browsers, which playwright-core's version matches and
// the devshell and `cella` export as PLAYWRIGHT_BROWSERS_PATH.
// `BROWSERS` (comma-separated) narrows the browsers run.

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
// as Playwright runs Chromium without its own.
async function firefoxLaunch(): Promise<Browser> {
  const home = mkdtempSync(join(tmpdir(), 'cella-firefox-'))
  const browser = await firefox.launch({ env: { ...process.env, HOME: home, MOZ_DISABLE_CONTENT_SANDBOX: '1' } })
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

const free = () =>
  new Promise<number>((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })

// The built shell in dev mode, whose sign-in page offers the fixture
// members.
export async function serve(): Promise<{ base: string; stop: () => Promise<void> }> {
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
    await page.waitForURL(`${base}/`)
  } finally {
    await page.close()
  }
}
