// demo-serve: the demo's front (`cella demo serve`), the one address a
// host serves for its demo. Each visitor is served a copy of the template
// of their own: a database made from it by CREATE DATABASE … TEMPLATE, a
// login role that reaches that database alone, and a server of its own,
// the built shell, as `cella-server` runs it, on a Unix socket, which the
// front starts as a child and passes that visitor's requests to, and no
// one else's.
//
// The visitor is known by a cookie holding 32 random bytes and nothing
// else; the front keeps, in memory alone, which copy it names and when
// its visitor was last seen. Nothing about a visitor is written down: no
// address, no name, no log line naming their cookie.
//
// A visitor arriving without a copy is shown a page saying their co-op is
// being prepared, whose script asks the front to make one (POST
// /_demo/start), so a crawler that runs no script makes none; once made,
// the page goes on to it. A copy ends after `--idle` seconds with no
// request, when its server passes `--memory`, at Reset now (POST
// /_demo/reset, which makes a fresh one at once), and when a visitor
// would pass `--cap`, the copy idle longest, if it has been idle
// `--evict-after` seconds; else the newcomer is asked to come back. To
// end a copy is to stop its server, then drop its database and its role.
// The front starts by ending every copy an earlier run of it left.
//
// It talks to Postgres as its own role over the cluster's socket, by the
// PG* variables (`cella_demo_front` on `postgres`), a role that may make
// databases and roles and grant `cella_app`, never be it: so it drops a
// database only where it owns it, a copy it made, and it checks each
// name and comment before it does.
//
//   node tools/demo-serve.mjs --template NAME --server DIR [--port 3000]
//     [--host 127.0.0.1] [--prefix NAME_v] [--sockets DIR] [--cap 10]
//     [--idle 7200] [--evict-after 300] [--memory 256] [--connections 10]
//     [--per-ip 5] [--per-ip-window 600] [--per-minute 20] [--tick 30]
//     [--trust-proxy]

import { spawn } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, rmSync, mkdirSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'
import pg from 'pg'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i < 0 ? fallback : args[i + 1]
}
const whole = (name, fallback) => {
  const v = Number(flag(name, fallback))
  if (!Number.isInteger(v) || v < 1) {
    throw new Error(`demo serve: ${name} is a whole number above zero`)
  }
  return v
}

const IDENT = /^[a-z_][a-z0-9_]{0,40}$/
const template = flag('--template')
const server = flag('--server')
if (!template || !IDENT.test(template) || !server) {
  throw new Error('demo serve: --template NAME (the template database) and --server DIR (the built shell, apps/org/ts/build)')
}
const prefix = flag('--prefix', `${template.replace(/_template$/, '')}_v`)
if (!IDENT.test(prefix)) {
  throw new Error(`demo serve: --prefix ${prefix} is no plain lower-case name`)
}
const config = {
  port: whole('--port', 3000),
  host: flag('--host', '127.0.0.1'),
  sockets: flag('--sockets', process.env.RUNTIME_DIRECTORY ?? join(process.cwd(), '.data', 'visitors')),
  cap: whole('--cap', 10),
  idle: whole('--idle', 7200),
  evictAfter: whole('--evict-after', 300),
  memory: whole('--memory', 256),
  connections: whole('--connections', 10),
  perIp: whole('--per-ip', 5),
  perIpWindow: whole('--per-ip-window', 600),
  perMinute: whole('--per-minute', 20),
  // A check at least four times in each idle span, so a copy ends soon after.
  tick: Math.min(whole('--tick', 30), Math.max(1, Math.floor(whole('--idle', 7200) / 4))),
  trustProxy: args.includes('--trust-proxy'),
}
// A copy's database and its role share one name: the prefix and 16 hex
// digits, random, never the visitor's cookie.
const COPY = new RegExp(`^${prefix}_[0-9a-f]{16}$`)
const MARK = `a copy of ${template}: `
const COOKIE = 'cella-visitor'
const log = (line) => console.log(`demo serve: ${line}`)

// --- Postgres, as the front's own role ---------------------------------

async function admin(work) {
  const db = new pg.Client({ database: 'postgres', application_name: 'cella demo front' })
  await db.connect()
  try {
    return await work(db)
  } finally {
    await db.end()
  }
}
const id = (name) => `"${name}"`
const literal = (s) => `'${String(s).replaceAll("'", "''")}'`

// What the template's database and its app role carry there, which a copy
// does not take by itself (as `cella demo copy` sets them): the scope's
// address and timezone, and the story's clock, read once.
let settings = null
async function templateSettings(db) {
  const source = (
    await db.query("SELECT oid, datistemplate, coalesce(shobj_description(oid, 'pg_database'), '') AS made FROM pg_database WHERE datname = $1", [template])
  ).rows[0]
  if (!source?.datistemplate) {
    throw new Error(`${template} is no template; build it with cella demo template`)
  }
  const { rows } = await db.query(
    `SELECT r.rolname AS role, s.setconfig AS config
       FROM pg_db_role_setting s LEFT JOIN pg_roles r ON r.oid = s.setrole
      WHERE s.setdatabase = $1 AND (s.setrole = 0 OR r.rolname = 'cella_app')`,
    [source.oid],
  )
  const split = (setting) => [setting.slice(0, setting.indexOf('=')), setting.slice(setting.indexOf('=') + 1)]
  return {
    made: source.made,
    database: rows.filter((r) => !r.role).flatMap((r) => r.config.map(split)),
    app: rows.filter((r) => r.role).flatMap((r) => r.config.map(split)),
  }
}
const setting = (key) => key.split('.').map((k) => id(k)).join('.')

// A copy made: its role, which logs in by a password only its server is
// handed and may act as `cella_app` and nothing more; its database, from
// the template, which no one but that role may connect to; the settings
// the template carries; and the comment that marks it a copy.
async function make() {
  const name = `${prefix}_${randomBytes(8).toString('hex')}`
  const password = randomBytes(24).toString('base64url')
  await admin(async (db) => {
    settings ??= await templateSettings(db)
    await db.query(`CREATE ROLE ${id(name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT ${config.connections} PASSWORD ${literal(password)}`)
    try {
      await db.query(`GRANT cella_app TO ${id(name)}`)
      await db.query(`CREATE DATABASE ${id(name)} TEMPLATE ${id(template)} CONNECTION LIMIT ${config.connections + 2}`)
      await db.query(`COMMENT ON DATABASE ${id(name)} IS ${literal(MARK + settings.made)}`)
      await db.query(`REVOKE ALL ON DATABASE ${id(name)} FROM PUBLIC`)
      await db.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${id(name)} TO ${id(name)}`)
      for (const [key, value] of settings.database) {
        await db.query(`ALTER DATABASE ${id(name)} SET ${setting(key)} = ${literal(value)}`)
      }
      // The app role's settings there are the visitor role's, which logs in.
      for (const [key, value] of settings.app) {
        await db.query(`ALTER ROLE ${id(name)} IN DATABASE ${id(name)} SET ${setting(key)} = ${literal(value)}`)
      }
      await db.query(`ALTER ROLE ${id(name)} IN DATABASE ${id(name)} SET temp_file_limit = '128MB'`)
    } catch (e) {
      await drop(db, name).catch(() => {})
      throw e
    }
  })
  return { name, password }
}

// A copy's database and role dropped, where the name is a copy's, the
// database is marked one and the front owns it; Postgres refuses the
// front any other.
async function drop(db, name) {
  if (!COPY.test(name)) {
    throw new Error(`refused to drop ${name}: no copy's name`)
  }
  const row = (
    await db.query(
      "SELECT coalesce(shobj_description(oid, 'pg_database'), '') AS comment, pg_get_userbyid(datdba) = current_user AS ours FROM pg_database WHERE datname = $1",
      [name],
    )
  ).rows[0]
  if (row) {
    if (!row.comment.startsWith(MARK) || !row.ours) {
      throw new Error(`refused to drop ${name}: not a copy this front made`)
    }
    await db.query(`DROP DATABASE ${id(name)} WITH (FORCE)`)
  }
  if ((await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name])).rowCount) {
    await db.query(`DROP ROLE ${id(name)}`)
  }
}

// Every copy an earlier run left, ended: its server went with that run.
async function sweep() {
  await admin(async (db) => {
    const { rows } = await db.query(
      `SELECT datname AS name FROM pg_database
        WHERE pg_get_userbyid(datdba) = current_user AND shobj_description(oid, 'pg_database') LIKE $1
       UNION SELECT r.rolname FROM pg_roles r
        JOIN pg_auth_members m ON m.roleid = r.oid AND m.member = (SELECT oid FROM pg_roles WHERE rolname = current_user) AND m.admin_option`,
      [`${MARK.replaceAll('_', '\\_')}%`],
    )
    for (const { name } of rows.filter((r) => COPY.test(r.name))) {
      await drop(db, name)
      log(`an earlier run's copy ${name} ended`)
    }
  })
}

// --- copies and their servers ------------------------------------------

// The copies, by their visitor's cookie.
const copies = new Map()
let preparing = 0

function socketOf(name) {
  return join(config.sockets, `${name}.sock`)
}

async function start(cookie) {
  const begun = Date.now()
  const copy = { name: null, child: null, seen: Date.now(), made: Date.now(), ready: null, ended: false, cookie }
  copies.set(cookie, copy)
  preparing++
  copy.ready = (async () => {
    try {
      const { name, password } = await make()
      copy.name = name
      if (copy.ended) {
        throw new Error('ended while it was made')
      }
      const socket = socketOf(name)
      rmSync(socket, { force: true })
      // Its server knows its database, its role's password and its socket,
      // and nothing of the front's or any other copy's.
      copy.child = spawn(process.execPath, [server], {
        env: {
          PATH: process.env.PATH ?? '',
          SOCKET_PATH: socket,
          PGHOST: process.env.PGHOST ?? '/run/postgresql',
          PGDATABASE: name,
          PGUSER: name,
          PGPASSWORD: password,
          CELLA_DEMO: '1',
          CELLA_DEMO_IDLE: String(config.idle),
          PROTOCOL_HEADER: 'x-forwarded-proto',
          BODY_SIZE_LIMIT: '11M',
          NODE_OPTIONS: `--max-old-space-size=${Math.max(64, Math.floor(config.memory * 0.6))}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const tag = (stream) =>
        stream.on('data', (chunk) => {
          for (const line of String(chunk).split('\n').filter(Boolean)) {
            console.log(`${name}: ${line}`)
          }
        })
      tag(copy.child.stdout)
      tag(copy.child.stderr)
      copy.child.on('exit', (code, signal) => {
        if (!copy.ended) {
          log(`${name}'s server stopped (${signal ?? code})`)
          end(copy, 'its server stopped')
        }
      })
      await answers(socket, copy)
      log(`${name} served, ${Date.now() - begun} ms from the request`)
    } finally {
      preparing--
    }
  })()
  copy.ready.catch((e) => {
    log(`a copy could not be made: ${e.message}`)
    end(copy, 'it could not be made')
  })
  return copy
}

// Waits until the copy's server answers on its socket, 60 s at most.
async function answers(socket, copy) {
  for (let i = 0; i < 600; i++) {
    if (copy.ended) {
      throw new Error('ended before it answered')
    }
    const ok = await new Promise((resolve) => {
      const req = http.request({ socketPath: socket, path: '/sign-in', method: 'HEAD' }, (res) => {
        res.resume()
        resolve(true)
      })
      req.on('error', () => resolve(false))
      req.end()
    })
    if (ok) {
      return
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('its server did not answer in 60 s')
}

// A copy ended: forgotten by its cookie at once, its server stopped, its
// database and role dropped. Ending it again does nothing.
const ending = new Set()
function end(copy, why) {
  if (copy.ended) {
    return copy.gone
  }
  copy.ended = true
  if (copies.get(copy.cookie) === copy) {
    copies.delete(copy.cookie)
  }
  ending.add(copy)
  copy.gone = (async () => {
    const child = copy.child
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((r) => child.once('exit', r))
      child.kill('SIGTERM')
      const late = setTimeout(() => child.kill('SIGKILL'), 5000)
      await exited
      clearTimeout(late)
    }
    if (copy.name) {
      rmSync(socketOf(copy.name), { force: true })
      // A copy made but failing at once may still be making its database.
      await copy.ready?.catch(() => {})
      await admin((db) => drop(db, copy.name))
      log(`${copy.name} ended: ${why}`)
    }
  })()
    .catch((e) => log(`${copy.name} did not end cleanly: ${e.message}`))
    .finally(() => ending.delete(copy))
  return copy.gone
}

// Every tick: a copy idle past `--idle` ends, and one whose server holds
// more than `--memory` MiB resident.
function rss(child) {
  try {
    const m = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${child.pid}/status`, 'utf8'))
    return m ? Number(m[1]) / 1024 : 0
  } catch {
    return 0
  }
}
setInterval(() => {
  const now = Date.now()
  for (const copy of [...copies.values()]) {
    if (now - copy.seen > config.idle * 1000) {
      end(copy, `idle ${Math.round((now - copy.seen) / 1000)} s`)
    } else if (copy.child && rss(copy.child) > config.memory) {
      end(copy, `its server passed ${config.memory} MiB`)
    }
  }
}, config.tick * 1000).unref()

// --- limits on making copies -------------------------------------------

// How many copies each address made lately, and the host made this
// minute: in memory alone, each forgotten once its window is past.
const made = new Map()
let minute = { at: 0, n: 0 }
function allowed(ip) {
  const now = Date.now()
  if (now - minute.at > 60_000) {
    minute = { at: now, n: 0 }
  }
  for (const [k, times] of made) {
    const kept = times.filter((t) => now - t < config.perIpWindow * 1000)
    kept.length ? made.set(k, kept) : made.delete(k)
  }
  const mine = made.get(ip) ?? []
  if (mine.length >= config.perIp || minute.n >= config.perMinute || preparing >= 3) {
    return false
  }
  made.set(ip, [...mine, now])
  minute.n++
  return true
}

// Room for one more copy: below the cap, or the copy idle longest ended,
// if it has been idle long enough; else none.
async function room() {
  if (copies.size + ending.size < config.cap) {
    return true
  }
  const idlest = [...copies.values()].sort((a, b) => a.seen - b.seen)[0]
  if (!idlest || Date.now() - idlest.seen < config.evictAfter * 1000) {
    return false
  }
  await end(idlest, 'the idlest, at the cap')
  return copies.size + ending.size < config.cap
}

// --- the visitor's cookie ----------------------------------------------

function cookieOf(req) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === COOKIE) {
      const value = v.join('=')
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
    }
  }
  return null
}
// The copy a cookie names, compared in constant time.
function copyOf(cookie) {
  if (!cookie) {
    return null
  }
  const given = Buffer.from(cookie)
  for (const [k, copy] of copies) {
    const b = Buffer.from(k)
    if (b.length === given.length && timingSafeEqual(b, given)) {
      return copy
    }
  }
  return null
}
const secure = (req) => req.headers['x-forwarded-proto'] === 'https'
const setCookie = (req, value) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}${secure(req) ? '; Secure' : ''}`
// The visitor's own cookie stripped from what their server is handed.
const withoutOurs = (header) =>
  (header ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith(`${COOKIE}=`))
    .join('; ')

function addressOf(req) {
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (forwarded.length) {
      return forwarded[forwarded.length - 1]
    }
  }
  return req.socket.remoteAddress ?? ''
}

// A POST from this host's own pages, as a browser says it.
function sameOrigin(req) {
  const origin = req.headers.origin
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin') {
    return false
  }
  if (!origin) {
    return !!site
  }
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

// --- the front's own pages ---------------------------------------------

const NOTICE = "This is a prototype environment for demo purposes and can't be used for real work."
const hours = () => (config.idle % 3600 === 0 ? `${config.idle / 3600} hour${config.idle === 3600 ? '' : 's'}` : `${Math.round(config.idle / 60)} minutes`)

function page(res, status, { title, lines, script = '', headers = {} }) {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>
:root{color-scheme:light dark;--bg:#f6f4ef;--fg:#1f1d1a;--soft:#f3e3bf;--soft-fg:#5c4210}
@media (prefers-color-scheme:dark){:root{--bg:#1b1a18;--fg:#ece8e1;--soft:#3d321c;--soft-fg:#f0d9a6}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;padding:16px;box-sizing:border-box}
main{max-width:32rem}p.notice{background:var(--soft);color:var(--soft-fg);padding:.6rem .8rem;border-radius:.4rem;font-size:.9rem}
</style></head><body><main>
<p class="notice" role="note"><b>Prototype.</b> ${NOTICE}</p>
${lines.map((l) => `<p>${l}</p>`).join('\n')}
</main>${script}</body></html>`
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...headers })
  res.end(body)
}

function prepare(res, again) {
  page(res, 200, {
    title: 'Preparing your co-op',
    lines: [
      ...(again ? ['Your earlier copy was reset.'] : []),
      'Your copy of Lanterne, a mock co-op, is being prepared: it is yours alone, nobody else sees what you do in it, and nobody signs up.',
      `It resets after ${hours()} with no visit.`,
      '<noscript>Preparing it needs JavaScript.</noscript><span id="state"></span>',
    ],
    script: `<script>
(async () => {
  const state = document.getElementById('state')
  for (let i = 0; i < 30; i++) {
    const res = await fetch('/_demo/start', { method: 'POST', credentials: 'same-origin' }).catch(() => null)
    if (res && res.ok) { location.reload(); return }
    const text = res ? await res.text() : 'The demo cannot be reached.'
    state.textContent = text
    await new Promise((r) => setTimeout(r, 10000))
  }
})()
</script>`,
  })
}

function plain(res, status, text, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers })
  res.end(text)
}

// --- the front ----------------------------------------------------------

async function handle(req, res) {
  const path = (req.url ?? '/').split('?')[0]
  const cookie = cookieOf(req)
  const copy = copyOf(cookie)

  if (path === '/robots.txt') {
    return plain(res, 200, 'User-agent: *\nDisallow: /\n')
  }
  if (path === '/_demo/health') {
    return plain(res, 200, `${copies.size} of ${config.cap}\n`)
  }
  if (path === '/_demo/start' || path === '/_demo/reset') {
    req.resume()
    if (req.method !== 'POST' || !sameOrigin(req)) {
      return plain(res, 403, 'Only this demo’s own pages ask for a copy.')
    }
    if (path === '/_demo/reset') {
      if (!copy) {
        return plain(res, 303, 'No copy to reset.', { location: '/' })
      }
      if (Date.now() - copy.made < 20_000) {
        return plain(res, 303, 'Your copy is fresh already.', { location: '/' })
      }
    } else if (copy) {
      await copy.ready.catch(() => {})
      return plain(res, copy.ended ? 503 : 200, copy.ended ? 'Your copy could not be made; try again.' : 'ready')
    }
    // Counted before a reset ends the copy, so a visitor refused keeps it.
    if (!allowed(addressOf(req))) {
      return plain(res, 429, 'Too many copies made from here lately; try again in a few minutes.', { 'retry-after': '120' })
    }
    if (copy) {
      await end(copy, 'Reset now')
    }
    if (!(await room())) {
      return plain(res, 503, 'Every copy the demo holds is in use; try again in a few minutes.', { 'retry-after': '300' })
    }
    // A fresh cookie for every copy: an earlier one names nothing.
    const fresh = randomBytes(32).toString('base64url')
    const made = await start(fresh)
    const headers = { 'set-cookie': setCookie(req, fresh) }
    if (path === '/_demo/reset') {
      await made.ready.catch(() => {})
      return plain(res, 303, 'A fresh copy.', { ...headers, location: '/' })
    }
    try {
      await made.ready
      return plain(res, 200, 'ready', headers)
    } catch {
      return plain(res, 503, 'Your copy could not be made; try again.')
    }
  }

  if (!copy) {
    req.resume()
    if (req.method === 'GET' || req.method === 'HEAD') {
      return prepare(res, !!cookie)
    }
    return plain(res, 409, 'Your copy was reset; reload the page.')
  }

  copy.seen = Date.now()
  try {
    await copy.ready
  } catch {
    req.resume()
    return prepare(res, true)
  }
  const headers = { ...req.headers, cookie: withoutOurs(req.headers.cookie) }
  if (!headers.cookie) {
    delete headers.cookie
  }
  delete headers['x-forwarded-for']
  const upstream = http.request({ socketPath: socketOf(copy.name), path: req.url, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', () => {
    if (!res.headersSent) {
      plain(res, 502, 'Your copy did not answer; reload the page.')
    } else {
      res.destroy()
    }
  })
  req.pipe(upstream)
}

mkdirSync(config.sockets, { recursive: true, mode: 0o700 })
await sweep()
const front = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    log(`a request failed: ${e.message}`)
    if (!res.headersSent) {
      plain(res, 500, 'The demo failed; reload the page.')
    }
  })
})
front.headersTimeout = 20_000
front.requestTimeout = 120_000
front.listen(config.port, config.host, () => {
  log(`on http://${config.host}:${config.port}, ${config.cap} copies of ${template} at most, each ending after ${config.idle} s idle`)
})

async function stop() {
  front.close()
  await Promise.all([...copies.values()].map((c) => end(c, 'the front stopped')))
  await Promise.all([...ending].map((c) => c.gone))
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
