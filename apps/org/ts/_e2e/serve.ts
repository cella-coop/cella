// The built shell as a scenario drives it, outside dev mode as a scope's
// server runs: started on a day of the notary's choosing, its pages
// fetched and its writes posted as the page's script posts them,
// signed in as a member and signing each write as their browser does,
// with their TEST-ONLY fixture device, which the test holds as a browser
// holds its key.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import type pg from 'pg'
import { parse, stringify } from 'devalue'
import { bound } from '@cella/org-ui/models'
import { fixture, open, signer, type Device, type Json } from '@cella/org-sign'

const entry = new URL('../build/index.js', import.meta.url).pathname
// The TEST-ONLY crash point a scenario may load into the server.
const crash = new URL('./crash.ts', import.meta.url).href

export interface Done {
  op: string
  state: string
  entry?: number
  reason?: string
  forgone?: boolean
  then: Done[]
  spent?: string[]
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
  // The signatures the last post asked its device for.
  signed = 0

  constructor(su: pg.Client) {
    this.su = su
  }

  get base() {
    return this.#base
  }

  // Starts the built server outside dev mode, as a scope's server runs,
  // after setting the notary's date for the app role, which each new
  // connection picks up; `env` adds to its environment, such as a
  // `DATABASE_URL` logging in as another role; `crashing`, an op, loads
  // the crash point, which kills the server once the notary answers that
  // op's entry. Sessions end with the server.
  async start(date: string, env: NodeJS.ProcessEnv = {}, crashing?: string) {
    await this.stop()
    await this.su.query(`ALTER ROLE cella_app IN DATABASE ${this.su.escapeIdentifier(this.su.database ?? '')} SET cella.clock = '${date}'`)
    const port = await free()
    this.#base = `http://127.0.0.1:${port}`
    const run: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1', PROTOCOL_HEADER: 'x-forwarded-proto' }
    delete run.DATABASE_URL
    delete run.CELLA_DEV
    delete run.CELLA_SESSION_KEY_FILE
    delete run.CELLA_E2E_CRASH
    const args = crashing ? ['--import', crash, entry] : [entry]
    this.#server = spawn(process.execPath, args, { env: { ...run, ...env, ...(crashing ? { CELLA_E2E_CRASH: crashing } : {}) }, stdio: ['ignore', 'pipe', 'inherit'] })
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

  // Reaches a server another process runs, as a host's unit does, at
  // `base`: its pages and writes as `start`'s, its process left alone.
  attach(base: string) {
    this.#server = undefined
    this.#sessions.clear()
    this.#base = base
  }

  async stop() {
    const server = this.#server
    // A server that killed itself has exited already.
    if (server && server.exitCode === null && server.signalCode === null) {
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

  // What a path answers as JSON, as a page's script asks it once the page
  // is in the browser, signed in as `actor`.
  async json(path: string, actor: string): Promise<unknown> {
    const res = await fetch(`${this.#base}${path}`, { headers: { accept: 'application/json', cookie: (await this.#session(actor)).cookie } })
    assert.ok(res.ok, `${path}: ${res.status}`)
    return res.json()
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
    this.signed = 0
    let result = await this.post(path, action, body, s.cookie)
    while (result.sign) {
      const ask = result.sign
      this.signed++
      assert.equal(ask.device, s.device.key, 'the server asks the signed-in device to sign')
      const proof = await signer(ask.scope, ask.actor, s.device)(ask.op, ask.request)
      result = await this.post(path, action, new URLSearchParams({ 'cella-run': ask.run, 'cella-proof': JSON.stringify(proof) }), s.cookie)
    }
    assert.ok(result.done, `${path} ${action}: ${JSON.stringify(result)}`)
    return result.done
  }

  // One post of a page's write as its script posts it, with a session's
  // cookie or none: its fields to the route's `write` form, bound to it
  // by name, or a proof, `cella-run` and `cella-proof`, by `prove`, an
  // invitation's link's by its `accept`; what the server answered, a
  // signature it asks for or the write's outcome, and the status it says.
  async post(path: string, action: string, body: URLSearchParams | FormData, cookie?: string): Promise<{ sign?: Ask; done?: Done; status: number }> {
    const [first, second] = path.split('/').filter(Boolean).map(decodeURIComponent)
    const run = body.get('cella-run')
    const headers = { origin: this.#base, 'x-forwarded-proto': 'http', ...(cookie ? { cookie } : {}) }
    let res: Response
    if (first === 'join') {
      const given = run
        ? { secret: second, key: '', label: '', run, proof: String(body.get('cella-proof') ?? '') }
        : { secret: second, key: String(body.get('key') ?? ''), label: String(body.get('label') ?? ''), run: '', proof: '' }
      res = await this.#command('session', 'accept', given, headers)
    } else if (typeof run === 'string') {
      res = await this.#command('session', 'prove', { run, proof: String(body.get('cella-proof') ?? '') }, headers)
    } else {
      const [family, at] = first === 'settings' ? ['settings', { settings: second }] : ['collection', second ? { collection: first, id: second } : { collection: first }]
      const form = `${remote(family!)}/write`
      const posted = new FormData()
      for (const [k, v] of body) {
        posted.append(bound(k, form), v)
      }
      const key = encodeURIComponent(JSON.stringify(JSON.stringify({ at, write: action, n: 'e2e' })))
      res = await fetch(`${this.#base}/_app/remote/${form}/${key}`, { method: 'POST', body: posted, headers })
    }
    if (res.status === 401) {
      return { status: 401 }
    }
    const out = (await res.json()) as { type: string; data?: string; error?: { message: string } }
    if (out.type !== 'result' || !out.data) {
      return { status: res.status, done: { op: 'none:none:none', state: 'failed', reason: out.error?.message ?? res.statusText, then: [] } }
    }
    const answer = parse(out.data)._ as { result?: unknown } & { sign?: Ask; done?: Done; status?: number }
    const a = (first === 'join' || typeof run === 'string' ? answer : answer.result) as { sign?: Ask; done?: Done; status?: number }
    return { ...a, status: a.status ?? res.status }
  }

  // A command over HTTP, as a client with no page posts it: its body as
  // JSON to `POST /api/<feat>/<verb>`, signed in as `actor`, and each
  // signature the server asks for signed by their device and posted back
  // to the same address. The outcome, the status it came with, and the
  // status of each answer that asked for a signature.
  async api(feat: string, verb: string, body: object, actor: string): Promise<{ done: Done; status: number; asked: number[] }> {
    const s = await this.#session(actor)
    const post = async (b: object) => {
      const res = await fetch(`${this.#base}/api/${feat}/${verb}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: s.cookie },
        body: JSON.stringify(b),
      })
      return { status: res.status, ...((await res.json()) as { sign?: Ask; done?: Done }) }
    }
    const asked: number[] = []
    let result = await post(body)
    while (result.sign) {
      const ask = result.sign
      asked.push(result.status)
      assert.equal(ask.device, s.device.key, 'the server asks the signed-in device to sign')
      const proof = await signer(ask.scope, ask.actor, s.device)(ask.op, ask.request)
      result = await post({ run: ask.run, proof })
    }
    assert.ok(result.done, `${feat}/${verb}: ${JSON.stringify(result)}`)
    return { done: result.done, status: result.status, asked }
  }

  // A command of the shell's, its argument as SvelteKit's client sends it.
  #command(family: string, name: string, arg: unknown, headers: Record<string, string>) {
    return fetch(`${this.#base}/_app/remote/${remote(family)}/${name}`, {
      method: 'POST',
      body: JSON.stringify({ payload: Buffer.from(stringify(arg)).toString('base64url'), refreshes: [] }),
      headers: { ...headers, 'content-type': 'application/json' },
    })
  }
}

// A remote module's id, as SvelteKit names it: the djb2 hash of its path
// from the shell's root, in base 36. SvelteKit is pinned, so this holds.
function remote(family: string): string {
  const file = `src/lib/remote/${family}.remote.ts`
  let h = 5381
  for (let i = file.length; i; ) {
    h = (h * 33) ^ file.charCodeAt(--i)
  }
  return (h >>> 0).toString(36)
}
