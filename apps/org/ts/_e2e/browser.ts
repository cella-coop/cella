// Real browsers against the built shell, for the scenarios that drive the
// editor as a person does: the shell's server in dev mode on a free port,
// and Playwright's Chromium, Firefox and WebKit from nixpkgs'
// playwright-driver.browsers, which playwright-core's version matches and
// the devshell and `cella` export as PLAYWRIGHT_BROWSERS_PATH.
// `BROWSERS` (comma-separated) narrows the browsers run.

import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { chromium, firefox, webkit, type BrowserType } from 'playwright-core'

const entry = new URL('../build/index.js', import.meta.url).pathname

export const engines: Record<string, BrowserType> = { chromium, firefox, webkit }

export function browsers(): [string, BrowserType][] {
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

// The built shell in dev mode, signing as the member the cookie names.
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
