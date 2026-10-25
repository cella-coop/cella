// The built shell as a scenario drives it, outside dev mode as a scope's
// server runs: started on a day of the notary's choosing, its pages
// fetched and its form actions posted as an enhanced form posts them,
// signed in as a member and signing each write as their browser does,
// with their TEST-ONLY fixture device, which the test holds as a browser
// holds its key.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import type pg from 'pg'
import { parse } from 'devalue'
import { fixture, open, signer, type Device, type Json } from '@cella/org-sign'

const entry = new URL('../build/index.js', import.meta.url).pathname

export interface Done {
  op: string
  state: string
  entry?: number
  reason?: string
  then: Done[]
}

// What the server asks a device to sign.
export interface Ask {
  run: string
  op: string
  request: Json
  scope: string
  actor: string
  device: string
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
  // Each member's session, by their address: the cookie their fixture
  // device's sign-in opened, and the device that signs their writes.
  #sessions = new Map<string, { cookie: string; device: Device }>()
  su: pg.Client

  constructor(su: pg.Client) {
    this.su = su
  }

  get base() {
    return this.#base
  }

  // Starts the built server outside dev mode, as a scope's server runs,
  // after setting the notary's date for the app role, which each new
  // connection picks up. Sessions end with the server.
  async start(date: string) {
    await this.stop()
    await this.su.query(`ALTER ROLE cella_app IN DATABASE ${this.su.escapeIdentifier(this.su.database ?? '')} SET cella.clock = '${date}'`)
    const port = await free()
    this.#base = `http://127.0.0.1:${port}`
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', PROTOCOL_HEADER: 'x-forwarded-proto' }
    delete env.DATABASE_URL
    delete env.CELLA_DEV
    delete env.CELLA_SESSION_KEY_FILE
    this.#server = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'inherit'] })
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(`${this.#base}/sign-in`)
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
    this.#sessions.clear()
  }

  // The member's fixture device in force, its TEST-ONLY key derived as
  // the seed derived it: what their browser would keep.
  async device(actor: string): Promise<Device> {
    const { rows } = await this.su.query<{ key: string; label: string }>(
      `SELECT encode(key, 'hex') AS key, label FROM person.device WHERE address = $1 AND revoked IS NULL ORDER BY enrolled`,
      [actor],
    )
    for (const r of rows) {
      const d = await fixture(actor, r.label)
      if (d.key === r.key) {
        return d
      }
    }
    throw new Error(`${actor} holds no fixture device in force`)
  }

  // Signs in as `actor` on `device`, their fixture device unless named,
  // as the sign-in page does: the server's challenge signed by the
  // device. Returns the session's cookie, or the server's refusal.
  async signIn(actor: string, device?: Device): Promise<string> {
    const d = device ?? (await this.device(actor))
    const { challenge, scope } = (await (await fetch(`${this.#base}/session`)).json()) as { challenge: string; scope: string }
    const sig = await open(scope, actor, d, challenge)
    const res = await fetch(`${this.#base}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'http' },
      body: JSON.stringify({ actor, device: d.key, challenge, sig }),
    })
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]
    if (!res.ok || !cookie) {
      throw new Error(`${actor} could not sign in: ${((await res.json()) as { reason?: string }).reason}`)
    }
    this.#sessions.set(actor, { cookie, device: d })
    return cookie
  }

  async #session(actor: string) {
    if (!this.#sessions.has(actor)) {
      await this.signIn(actor)
    }
    return this.#sessions.get(actor) as { cookie: string; device: Device }
  }

  // A page as `actor` sees it, signed in; with no one, as a browser
  // with no session reaches it.
  async page(path: string, actor?: string) {
    const headers: Record<string, string> = { accept: 'text/html' }
    if (actor) {
      headers.cookie = (await this.#session(actor)).cookie
    }
    // With no one signed in, the redirect to the sign-in is what is read.
    const res = await fetch(`${this.#base}${path}`, { headers, redirect: actor ? 'follow' : 'manual' })
    return { status: res.status, type: res.headers.get('content-type'), location: res.headers.get('location'), text: await res.text() }
  }

  // Posts a page's named action as a form does, signed in as `actor`, and
  // signs what the server asks with their device, as the browser does; a
  // field a form repeats, as a grid's rows, is given as pairs.
  async act(path: string, action: string, fields: Record<string, string | string[]> | [string, string][], actor: string): Promise<Done> {
    const body = new URLSearchParams()
    for (const [k, v] of Array.isArray(fields) ? fields : Object.entries(fields)) {
      for (const x of [v].flat()) {
        body.append(k, x)
      }
    }
    return this.#post(path, action, body, actor)
  }

  // Posts a page's named action with files, as a form holding a file input
  // posts it.
  async upload(
    path: string,
    action: string,
    fields: Record<string, string>,
    files: Record<string, { name: string; type: string; bytes: Uint8Array }>,
    actor: string,
  ): Promise<Done> {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) {
      body.append(k, v)
    }
    for (const [k, f] of Object.entries(files)) {
      body.append(k, new Blob([f.bytes as Uint8Array<ArrayBuffer>], { type: f.type }), f.name)
    }
    return this.#post(path, action, body, actor)
  }

  // A post and its relay: while the server asks for a signature, the
  // device signs and the proof goes back to the run it answers.
  async #post(path: string, action: string, body: URLSearchParams | FormData, actor: string): Promise<Done> {
    const s = await this.#session(actor)
    let result = await this.post(path, action, body, s.cookie)
    while (result.sign) {
      const ask = result.sign
      assert.equal(ask.device, s.device.key, 'the server asks the signed-in device to sign')
      const proof = await signer(ask.scope, ask.actor, s.device)(ask.op, ask.request)
      result = await this.post(path, action, new URLSearchParams({ 'cella-run': ask.run, 'cella-proof': JSON.stringify(proof) }), s.cookie)
    }
    assert.ok(result.done, `${path}?/${action}: ${JSON.stringify(result)}`)
    return result.done
  }

  // One post of a page's action as an enhanced form posts it, with a
  // session's cookie or none: what the action answered, a signature it
  // asks for or the write's outcome.
  async post(path: string, action: string, body: URLSearchParams | FormData, cookie?: string): Promise<{ sign?: Ask; done?: Done; status: number }> {
    const res = await fetch(`${this.#base}${path}?/${action}`, {
      method: 'POST',
      body,
      headers: { origin: this.#base, 'x-forwarded-proto': 'http', 'x-sveltekit-action': 'true', ...(cookie ? { cookie } : {}) },
    })
    if (res.status === 401) {
      return { status: 401 }
    }
    const result = await res.json()
    return { ...(result.data ? parse(result.data) : {}), status: res.status }
  }
}
