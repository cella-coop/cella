// The built shell as a scenario drives it: started on a day of the
// notary's choosing, its pages fetched and its form actions posted as an
// enhanced form posts them, acting as a member through the dev server's
// cookie.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import type pg from 'pg'
import { parse } from 'devalue'

const entry = new URL('../build/index.js', import.meta.url).pathname

export interface Done {
  op: string
  state: string
  entry?: number
  reason?: string
  then: Done[]
}

const free = () =>
  new Promise<number>((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })

export class Shell {
  #server: ChildProcess | undefined
  #base = ''
  su: pg.Client

  constructor(su: pg.Client) {
    this.su = su
  }

  // Starts the built server in dev mode, after setting the notary's date
  // for the app role, which each new connection picks up.
  async start(date: string) {
    await this.stop()
    await this.su.query(`ALTER ROLE cella_app IN DATABASE ${this.su.escapeIdentifier(this.su.database ?? '')} SET cella.clock = '${date}'`)
    const port = await free()
    this.#base = `http://127.0.0.1:${port}`
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', PROTOCOL_HEADER: 'x-forwarded-proto', CELLA_DEV: '1' }
    delete env.DATABASE_URL
    this.#server = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'inherit'] })
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`${this.#base}/search`)
        return
      } catch {
        await new Promise((r) => setTimeout(r, 100))
      }
    }
    throw new Error('the shell did not start')
  }

  async stop() {
    const server = this.#server
    if (server && server.exitCode === null) {
      const exited = new Promise((r) => server.once('exit', r))
      server.kill('SIGKILL')
      await exited
    }
    this.#server = undefined
  }

  async page(path: string, actor?: string) {
    const res = await fetch(`${this.#base}${path}`, { headers: actor ? { cookie: `cella-act=${actor}` } : {} })
    return { status: res.status, text: await res.text() }
  }

  // Posts a page's named action as an enhanced form does, acting as `actor`.
  async act(path: string, action: string, fields: Record<string, string>, actor: string): Promise<Done> {
    const res = await fetch(`${this.#base}${path}?/${action}`, {
      method: 'POST',
      body: new URLSearchParams(fields),
      headers: { origin: this.#base, 'x-forwarded-proto': 'http', 'x-sveltekit-action': 'true', cookie: `cella-act=${actor}` },
    })
    const result = await res.json()
    assert.ok(result.data, `${path}?/${action}: ${JSON.stringify(result)}`)
    return parse(result.data).done
  }
}
