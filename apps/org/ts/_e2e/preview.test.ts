// The preview of main, as a host serves it behind a gate of its own: this
// cella's `preview build` into a directory of its own, then its `preview
// serve` from it on a port of its own, with an analytics shell on a port
// of its own. Its sign-in offers Lanterne's fixture members, and one
// signed in in each browser reads a collection. Its database is
// `cella_preview`, so it writes nothing to the test database.
// alone: its build stages the extension and the shell anew and its serve restarts the cluster, which every other scenario runs on
// covers: core

import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { eachBrowser, free, signIn } from './browser.ts'
import { cella } from './cluster.ts'
import { own } from './port.ts'

const repo = new URL('../../../../', import.meta.url).pathname
const dir = mkdtempSync(join(tmpdir(), 'cella-preview-'))
const out = join(dir, 'build')
const analytics = own(61)
const camille = 'camille@lanterne.example'

let base = ''
let server: ChildProcess | undefined
let said = ''

before(async () => {
  cella(['preview', 'build', '--out', out])
  const port = await free()
  base = `http://127.0.0.1:${port}`
  // Its own process group, so its stop reaches the server it starts.
  server = spawn(process.env.CELLA_BIN!, ['preview', 'serve', '--port', String(port), '--from', out], {
    cwd: repo,
    env: { ...process.env, CELLA_ANALYTICS_PORT: analytics },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  server.stdout!.on('data', (d: Buffer) => (said += d.toString()))
  server.stderr!.on('data', (d: Buffer) => (said += d.toString()))
  // Its start restarts the cluster and seeds Lanterne before it listens.
  for (let i = 0; i < 1200; i++) {
    if (server.exitCode !== null) {
      throw new Error(`cella preview serve exited ${server.exitCode}:\n${said}`)
    }
    try {
      await fetch(`${base}/search`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error(`cella preview serve never answered:\n${said}`)
})

after(async () => {
  if (server?.pid && server.exitCode === null) {
    const exited = new Promise((r) => server!.once('exit', r))
    process.kill(-server.pid, 'SIGTERM')
    await exited
  }
  cella(['analytics', 'stop', '--port', analytics])
  rmSync(dir, { recursive: true, force: true })
})

it('serves on a fresh Lanterne in dev mode, in public never', () => {
  assert.match(said, /dev mode, database cella_preview/)
  assert.match(said, /never in public/)
})

it("offers Lanterne's fixture members at its sign-in", async () => {
  const res = await fetch(`${base}/sign-in`)
  assert.equal(res.status, 200)
  const page = await res.text()
  assert.match(page, new RegExp(`title="${camille}"`))
  assert.match(page, /Camille Martin/)
})

eachBrowser((name, launch) => {
  it('signs Camille in with a TEST-ONLY key, and reads a collection', async () => {
    const browser = await launch()
    try {
      const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
      const page = await context.newPage()
      const res = await page.goto(`${base}/people`)
      assert.equal(res?.status(), 200)
      await page.getByText('Camille Martin').first().waitFor()
    } finally {
      await browser.close()
    }
  })
})
