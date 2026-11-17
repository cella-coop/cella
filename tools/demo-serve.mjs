// demo-serve: the demo's front (`cella demo serve`), the one address a
// host serves for its demo. Each visitor is served a copy of the template,
// a room from here on: a database made from it by CREATE DATABASE …
// TEMPLATE, a login role that reaches that database alone, and a server
// of its own, the built shell, as `cella-server` runs it, on a Unix
// socket, which the front starts as a child and passes every browser in
// the room's requests to, and no other room's.
//
// A browser is known by a cookie holding 32 random bytes and nothing
// else; the front keeps, in memory alone, which room it is in and when
// it was last seen. A room's Share this copy link carries a join code,
// 16 more random bytes, compared in constant time and never logged: a
// browser that opens it leaves whatever room it was in and joins this
// one, a fresh cookie of its own, never the room's or the code. A room
// holds more than one browser at once; its member leases, one fixture
// member a browser at a time, are the server behind its socket's
// (`apps/org/ts/src/lib/server/leases.ts`), told each browser by an id
// the front derives from its cookie, a one-way hash, never the cookie
// itself. A browser unseen 15 minutes is forgotten: the room forgets its
// cookie, and its server's own idle sweep frees the member it leased.
// Nothing about a visitor is written down: no address, no name, no log
// line naming their cookie or a join code.
//
// A visitor arriving without a room is shown a page saying their co-op is
// being prepared, whose script asks the front to make one (POST
// /_demo/start), so a crawler that runs no script makes none; once made,
// the page goes on to it. Past `--cap` rooms at once, a newcomer sees a
// plain, auto-retrying queue page instead. A room ends after `--idle`
// seconds with no request from any browser in it, `--lifetime` seconds
// after it was made however busy, when its server passes `--memory` MiB,
// when it stores past twice `--storage` MiB (past `--storage` it takes no
// more writes), the room storing most while the disk holds less than
// `--disk-floor` MiB free, at Reset now (POST /_demo/reset, refused
// unless its browser is alone in the room, which makes a fresh room at
// once, its join code with it), and when a visitor would pass `--cap`:
// the room idle longest, if idle `--evict-after` seconds, else the
// oldest, if older than `--min-age`; else the newcomer is asked to come
// back. `--cap` unset, the host's memory less `--reserve` over
// `--footprint` MiB a room. A write takes no body past `--upload` MiB. An
// address, an IPv6 one by its /64, holds `--per-address` rooms at most and
// makes `--per-address-rate` in `--rate-window` seconds, the host
// `--per-minute`, `--concurrent` at once; only a room made counts, never
// one joined. To end a room is to stop its server, then drop its database
// and its role. The front starts by ending every room an earlier run of
// it left.
//
// It talks to Postgres as its own role over the cluster's socket, by the
// PG* variables (`<database>_front` on `postgres`), a role that may make
// databases and roles and grant `cella_app`, never be it: so it drops a
// database only where it owns it, a room it made, and it checks each
// name and comment before it does.
//
//   node tools/demo-serve.mjs --template NAME --server DIR [--port 3000]
//     [--host 127.0.0.1] [--prefix NAME_v] [--sockets DIR] [--cap N]
//     [--reserve 1536] [--footprint 160] [--idle 7200] [--lifetime 7200]
//     [--evict-after 300] [--min-age 600] [--browser-idle 900] [--memory 192]
//     [--connections 10] [--upload 2] [--storage 64] [--disk /var/lib]
//     [--disk-floor 1024] [--per-address CAP-4] [--per-address-rate 30]
//     [--rate-window 600] [--per-minute 60] [--concurrent 4] [--tick 30]
//     [--trust-proxy]

import { spawn } from 'node:child_process'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, statfsSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'
import pg from 'pg'
import { alone, joinCode, sameCode } from './demo-rooms.mjs'

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
// The copies a host holds, unless `--cap` says: its memory, less what the
// rest of the host needs (`--reserve`), over what one copy costs it, its
// server and its Postgres connections (`--footprint`), both in MiB.
function derivedCap(reserve, footprint) {
  const m = /MemTotal:\s+(\d+) kB/.exec(readFileSync('/proc/meminfo', 'utf8'))
  const total = m ? Number(m[1]) / 1024 : 0
  return Math.max(1, Math.floor((total - reserve) / footprint))
}
const idle = whole('--idle', 7200)
const cap = flag('--cap') ? whole('--cap') : derivedCap(whole('--reserve', 1536), whole('--footprint', 160))
const config = {
  port: whole('--port', 3000),
  host: flag('--host', '127.0.0.1'),
  sockets: flag('--sockets', process.env.RUNTIME_DIRECTORY ?? join(process.cwd(), '.data', 'visitors')),
  cap,
  idle,
  lifetime: whole('--lifetime', 7200),
  evictAfter: whole('--evict-after', 300),
  minAge: whole('--min-age', 600),
  // Fifteen minutes, as `leases.ts` defaults to on the server behind a
  // room's socket, which `--browser-idle` and this must agree with.
  browserIdle: whole('--browser-idle', 900),
  memory: whole('--memory', 192),
  connections: whole('--connections', 10),
  upload: whole('--upload', 2),
  storage: whole('--storage', 64),
  disk: flag('--disk', '/var/lib'),
  diskFloor: whole('--disk-floor', 1024),
  // Unset, all but four of the copies, so one address leaves room for others.
  perAddress: flag('--per-address') ? whole('--per-address') : Math.max(1, cap - 4),
  perAddressRate: whole('--per-address-rate', 30),
  rateWindow: whole('--rate-window', 600),
  perMinute: whole('--per-minute', 60),
  concurrent: whole('--concurrent', 4),
  // A check at least four times in each idle span, so a copy ends soon after.
  tick: Math.min(whole('--tick', 30), Math.max(1, Math.floor(idle / 4))),
  trustProxy: args.includes('--trust-proxy'),
}
// A copy's database and its role share one name: the prefix and 16 hex
// digits, random, never the visitor's cookie.
const COPY = new RegExp(`^${prefix}_[0-9a-f]{16}$`)
const MARK = `a copy of ${template}: `
// `__Host-`: set by this host alone, on every path, always over TLS.
const COOKIE = '__Host-cella-visitor'
const log = (line) => console.log(`demo serve: ${line}`)

// --- Postgres, as the front's own role ---------------------------------

// At most six connections at once, of the eight the front's role may hold,
// the rest waiting their turn, so a burst of checks never fails for want
// of one.
let open = 0
const turns = []
async function admin(work) {
  while (open >= 6) {
    await new Promise((r) => turns.push(r))
  }
  open++
  const db = new pg.Client({ database: 'postgres', application_name: 'cella demo front' })
  try {
    await db.connect()
    return await work(db)
  } finally {
    await db.end().catch(() => {})
    open--
    turns.shift()?.()
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

// The rooms, by every browser's cookie that is in one; two or more
// cookies may name the same room, a shared reference, where one browser
// joined another's. `seenAt`, that cookie's own last request, apart from
// `copy.seen`, the room's: a browser unseen `--browser-idle` seconds is
// forgotten here, its room untouched.
const copies = new Map()
const seenAt = new Map()
let preparing = 0

// A room's browsers, by their cookie, each with when it was last seen:
// what `alone` and the tick that forgets an idle one read.
function browsersOf(room) {
  const browsers = new Map()
  for (const [cookie, r] of copies) {
    if (r === room) {
      browsers.set(cookie, seenAt.get(cookie) ?? 0)
    }
  }
  return browsers
}

// The rooms held now, each once however many browsers are in it.
function rooms() {
  return new Set(copies.values())
}

function socketOf(name) {
  return join(config.sockets, `${name}.sock`)
}

async function start(cookie, address) {
  const begun = Date.now()
  // `size`: the bytes its visitor stored, past the template's; `full` once
  // past `--storage`, when it takes no more writes; `join`, this room's
  // link's code, made afresh here so a reset or a recycled room never
  // keeps the one it had.
  const copy = { name: null, child: null, seen: begun, made: begun, ends: begun + config.lifetime * 1000, ready: null, ended: false, cookie, address, size: 0, full: false, measured: 0, measuring: null, landed: [], flying: 0, uploads: 0, queue: [], join: joinCode() }
  copies.set(cookie, copy)
  seenAt.set(cookie, begun)
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
          // The server takes a URL's role as it is, where with none it names
          // `cella_app`, whom this role may act as and never log in as.
          DATABASE_URL: `postgresql://${name}:${password}@/${name}?host=${encodeURIComponent(process.env.PGHOST ?? '/run/postgresql')}`,
          CELLA_DEMO: '1',
          CELLA_DEMO_IDLE: String(config.idle),
          CELLA_DEMO_ENDS: String(Math.floor(copy.ends / 1000)),
          CELLA_DEMO_JOIN: copy.join,
          CELLA_DEMO_BROWSER_IDLE: String(config.browserIdle),
          PROTOCOL_HEADER: 'x-forwarded-proto',
          BODY_SIZE_LIMIT: `${config.upload}M`,
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

// A copy ended: forgotten by every browser's cookie that was in its room
// at once, so its join code, kept nowhere but on the room itself, goes
// with it; its server stopped, its database and role dropped. Ending it
// again does nothing.
const ending = new Set()
function end(copy, why) {
  if (copy.ended) {
    return copy.gone
  }
  copy.ended = true
  for (const [cookie, room] of [...copies]) {
    if (room === copy) {
      copies.delete(cookie)
      seenAt.delete(cookie)
    }
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

// What each copy stores past the template, by `pg_database_size`: past
// `--storage` MiB it takes no more writes, past twice that it ends. Read
// every tick, and before a write when the last reading is two seconds old,
// one reading a copy at a time, which every write waiting on it shares.
// A write is let through only where what the copy stored, what it was
// let write since that reading began, and its own body fit the quota.
let base = null
async function measure(list) {
  const named = list.filter((c) => c.name && !c.ended)
  if (!named.length) {
    return
  }
  const begun = Date.now()
  await admin(async (db) => {
    base ??= Number((await db.query('SELECT pg_database_size($1::name) AS n', [template])).rows[0].n)
    const { rows } = await db.query('SELECT datname, pg_database_size(oid) AS n FROM pg_database WHERE datname = ANY($1)', [named.map((c) => c.name)])
    const sizes = new Map(rows.map((r) => [r.datname, Number(r.n)]))
    for (const copy of named) {
      copy.size = Math.max(0, (sizes.get(copy.name) ?? base) - base)
      // What landed before this reading began is in it now; what lands
      // after counts until the next.
      copy.landed = copy.landed.filter((l) => l.at >= begun)
      copy.measured = begun
      copy.full = copy.size > config.storage * MiB
      if (copy.size > 2 * config.storage * MiB) {
        end(copy, `it stored ${Math.round(copy.size / MiB)} MiB`)
      }
    }
  })
}
const MiB = 1024 * 1024
// A fresh reading of one copy, shared by every write waiting on it.
function fresh(copy) {
  if (Date.now() - copy.measured <= 2000) {
    return Promise.resolve()
  }
  copy.measuring ??= measure([copy]).finally(() => {
    copy.measuring = null
  })
  return copy.measuring
}
// The bytes a copy may yet take: its quota, less what it stored at the
// last reading, what landed since, and what is in flight.
function quota(copy) {
  const landed = copy.landed.reduce((n, l) => n + l.bytes, 0)
  return config.storage * MiB - copy.size - landed - copy.flying
}

// The host's free disk where Postgres keeps its files, in MiB.
function freeDisk() {
  try {
    const s = statfsSync(config.disk)
    return (s.bavail * s.bsize) / MiB
  } catch {
    return Infinity
  }
}

// Every tick: a copy idle past `--idle` ends, one older than `--lifetime`
// however busy, and one whose server holds more than `--memory` MiB
// resident. Every five seconds: each copy is measured, one storing past
// twice `--storage` ends, and while the disk holds less than
// `--disk-floor` MiB free, the copies storing most end, as many as it
// takes to bring it back above.
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
  for (const copy of rooms()) {
    if (now - copy.seen > config.idle * 1000) {
      end(copy, `idle ${Math.round((now - copy.seen) / 1000)} s`)
    } else if (now > copy.ends) {
      end(copy, `its lifetime of ${config.lifetime} s`)
    } else if (copy.child && rss(copy.child) > config.memory) {
      end(copy, `its server passed ${config.memory} MiB`)
    }
  }
  // A browser unseen 15 minutes is forgotten: its room keeps going, for
  // another browser or a fresh join, but this one reaches it no more.
  for (const [cookie, room] of [...copies]) {
    if (!room.ended && now - (seenAt.get(cookie) ?? now) > config.browserIdle * 1000) {
      copies.delete(cookie)
      seenAt.delete(cookie)
    }
  }
}, config.tick * 1000).unref()
let watching = false
setInterval(async () => {
  if (watching) {
    return
  }
  watching = true
  try {
    await measure([...rooms()])
  } catch (e) {
    log(`the copies could not be measured: ${e.message}`)
  }
  try {
    let short = config.diskFloor - freeDisk()
    if (short > 0) {
      for (const copy of [...rooms()].filter((c) => c.name).sort((a, b) => b.size - a.size)) {
        if (short <= 0) {
          break
        }
        short -= copy.size / MiB
        await end(copy, `the disk is below ${config.diskFloor} MiB free, and it stored most`)
      }
    }
  } finally {
    watching = false
  }
}, 5000).unref()

// --- limits on making copies -------------------------------------------

// The address a request comes from, an IPv6 one by its /64, which one
// household or phone holds whole: the last `x-forwarded-for` hop where
// the host's proxy sets it (`--trust-proxy`), else the socket's peer.
function addressOf(req) {
  let ip = req.socket.remoteAddress ?? ''
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (forwarded.length) {
      ip = forwarded[forwarded.length - 1]
    }
  }
  ip = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '')
  if (!ip.includes(':')) {
    return ip
  }
  const [head, tail = ''] = ip.split('%')[0].split('::')
  const left = head ? head.split(':') : []
  const right = ip.includes('::') && tail ? tail.split(':') : []
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`
}

// The copies each address made lately, and the host this minute, each
// counted once made, so a refused or failed attempt costs nothing: in
// memory alone, forgotten once its window is past.
const made = new Map()
let minute = { at: 0, n: 0 }
function prune(now) {
  if (now - minute.at > 60_000) {
    minute = { at: now, n: 0 }
  }
  for (const [k, times] of made) {
    const kept = times.filter((t) => now - t < config.rateWindow * 1000)
    kept.length ? made.set(k, kept) : made.delete(k)
  }
}
// Why a copy cannot be made for `address` now, with the status to answer,
// or null: copies being made at once, the copies it holds (`--per-address`,
// the one a reset ends aside), the copies it made lately, the host's rate,
// and the disk.
function refusal(address, resetting) {
  prune(Date.now())
  const held = [...rooms()].filter((c) => c.address === address && c !== resetting).length
  if (preparing >= config.concurrent) {
    return [503, 'Several copies are being prepared; yours is next in a moment.']
  }
  if (held >= config.perAddress) {
    return [429, `Your network holds ${held} copies of the demo already, as many as one may; try again once one resets.`]
  }
  if ((made.get(address) ?? []).length >= config.perAddressRate || minute.n >= config.perMinute) {
    return [429, 'Many copies were made from here lately; try again in a few minutes.']
  }
  if (freeDisk() < config.diskFloor) {
    return [503, 'The demo is short of room just now; try again in a few minutes.']
  }
  return null
}
function counted(address) {
  made.set(address, [...(made.get(address) ?? []), Date.now()])
  minute.n++
}

// Room for one more copy: below the cap, or else the copy idle longest
// ended, if idle `--evict-after` seconds, or else the oldest, if older
// than `--min-age`; else none.
async function room() {
  if (rooms().size + ending.size < config.cap) {
    return true
  }
  const now = Date.now()
  const all = [...rooms()]
  const idlest = all.filter((c) => now - c.seen >= config.evictAfter * 1000).sort((a, b) => a.seen - b.seen)[0]
  const oldest = all.filter((c) => now - c.made >= config.minAge * 1000).sort((a, b) => a.made - b.made)[0]
  const out = idlest ?? oldest
  if (!out) {
    return false
  }
  await end(out, idlest ? 'the idlest, at the cap' : 'the oldest, at the cap')
  return rooms().size + ending.size < config.cap
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
const setCookie = (value) => `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
// The visitor's own cookie stripped from what their server is handed.
const withoutOurs = (header) =>
  (header ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith(`${COOKIE}=`))
    .join('; ')

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

// A visitor with no room, shown while the front makes one, polling
// `/_demo/start`: `queued`, every room full already, says so plainly
// instead, the same script retrying it until one frees up.
function prepare(res, { again = false, queued = false } = {}) {
  page(res, 200, {
    title: queued ? 'Waiting for a free copy' : 'Preparing your co-op',
    lines: [
      ...(again ? ['Your earlier copy was reset.'] : []),
      queued
        ? 'Every copy of Lanterne, a mock co-op, is in use right now. This page asks again every few seconds and goes on as soon as one frees up.'
        : 'Your copy of Lanterne, a mock co-op, is being prepared: it is yours to share, nobody outside it sees what you do, and nobody signs up.',
      `It resets after ${hours()} with no visit.`,
      '<noscript>Preparing it needs JavaScript.</noscript><span id="state"></span>',
    ],
    script: `<script>
(async () => {
  const state = document.getElementById('state')
  for (let i = 0; i < 120; i++) {
    const res = await fetch('/_demo/start', { method: 'POST', credentials: 'same-origin' }).catch(() => null)
    if (res && res.ok) { location.reload(); return }
    const text = res ? await res.text() : 'The demo cannot be reached.'
    state.textContent = text
    await new Promise((r) => setTimeout(r, res && res.status === 503 ? 4000 : 15000))
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
  // A browser found idle past `--browser-idle` is forgotten here, at
  // once, not only once the tick next sweeps it, so it reaches its old
  // room no more from the moment it is found idle, whichever asks first.
  if (cookie && Date.now() - (seenAt.get(cookie) ?? 0) > config.browserIdle * 1000) {
    copies.delete(cookie)
    seenAt.delete(cookie)
  }
  const copy = copyOf(cookie)

  if (path === '/robots.txt') {
    return plain(res, 200, 'User-agent: *\nDisallow: /\n')
  }
  if (path === '/_demo/health') {
    return plain(res, 200, `${rooms().size} of ${config.cap}\n`)
  }
  if (path === '/_demo/join') {
    req.resume()
    if (req.method !== 'GET') {
      return plain(res, 405, 'A room’s link is opened, not posted to.')
    }
    // The code, compared in constant time against every room's, as a
    // cookie is; never logged, by this request's path or any other.
    const code = new URL(req.url ?? '/', 'http://_').searchParams.get('code') ?? ''
    const target = [...rooms()].find((c) => !c.ended && sameCode(c.join, code))
    if (!target) {
      return plain(res, 404, 'This room’s link is no longer good; it may have reset.')
    }
    const fresh = randomBytes(32).toString('base64url')
    copies.set(fresh, target)
    seenAt.set(fresh, Date.now())
    return plain(res, 303, 'Joined.', { 'set-cookie': setCookie(fresh), location: '/' })
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
      if (!alone(browsersOf(copy), cookie, Date.now(), config.browserIdle * 1000)) {
        return plain(res, 409, 'Reset now works only while you are alone in this room; another browser is still in it.')
      }
    } else if (copy) {
      await copy.ready.catch(() => {})
      return plain(res, copy.ended ? 503 : 200, copy.ended ? 'Your copy could not be made; try again.' : 'ready')
    }
    // Checked before a reset ends the copy, so a visitor refused keeps it.
    const address = addressOf(req)
    const refused = refusal(address, path === '/_demo/reset' ? copy : null)
    if (refused) {
      return plain(res, refused[0], refused[1], { 'retry-after': refused[0] === 503 ? '5' : '60' })
    }
    if (copy) {
      await end(copy, 'Reset now')
    }
    if (!(await room())) {
      return plain(res, 503, 'Every copy the demo holds is in use; try again in a few minutes.', { 'retry-after': '60' })
    }
    // A fresh cookie for every copy: an earlier one names nothing.
    const fresh = randomBytes(32).toString('base64url')
    const next = await start(fresh, address)
    const ok = await next.ready.then(
      () => true,
      () => false,
    )
    if (ok) {
      counted(address)
    }
    const headers = { 'set-cookie': setCookie(fresh) }
    if (path === '/_demo/reset') {
      return plain(res, 303, 'A fresh copy.', { ...headers, location: '/' })
    }
    return ok ? plain(res, 200, 'ready', headers) : plain(res, 503, 'Your copy could not be made; try again.')
  }

  if (!copy) {
    req.resume()
    if (req.method === 'GET' || req.method === 'HEAD') {
      return prepare(res, { again: !!cookie, queued: rooms().size >= config.cap })
    }
    return plain(res, 409, 'Your copy was reset; reload the page.')
  }

  copy.seen = Date.now()
  seenAt.set(cookie, copy.seen)
  try {
    await copy.ready
  } catch {
    req.resume()
    return prepare(res, { again: true })
  }
  // A write: no body past `--upload` MiB, nor of no stated length, and
  // none past what the copy may yet store of `--storage` MiB, by a reading
  // at most two seconds old and what it was let write since.
  const limit = config.upload * MiB
  const writes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET')
  if (writes) {
    if (Number(req.headers['content-length'] ?? 0) > limit) {
      req.resume()
      return plain(res, 413, `A demo takes files up to ${config.upload} MB.`, { connection: 'close' })
    }
    // A body of no stated length, which no page of the app sends, is
    // refused before any of it reaches the server.
    if (req.headers['transfer-encoding'] && req.headers['content-length'] === undefined) {
      req.resume()
      return plain(res, 411, 'A demo takes a body of a stated length.', { connection: 'close' })
    }
    // An upload, a body past 64 KiB, waits for one of the copy's two
    // turns, so no burst of them is judged against one reading at once.
    const bytes = Number(req.headers['content-length'] ?? 0)
    let release = () => {}
    if (bytes > 64 * 1024) {
      const waited = Date.now()
      while (copy.uploads >= 2) {
        if (Date.now() - waited > 60_000 || copy.ended) {
          req.resume()
          return plain(res, 503, 'Your copy is busy with other uploads; try again.', { 'retry-after': '5' })
        }
        await new Promise((r) => {
          copy.queue.push(r)
          setTimeout(r, 5000).unref()
        })
      }
      copy.uploads++
      let released = false
      release = () => {
        if (!released) {
          released = true
          copy.uploads--
          copy.queue.shift()?.()
        }
      }
    }
    // Fails closed: a reading that fails refuses the write.
    try {
      await fresh(copy)
    } catch (e) {
      log(`${copy.name} could not be measured: ${e.message}`)
      release()
      req.resume()
      return plain(res, 503, 'Your copy could not be checked for room just now; try again.', { 'retry-after': '5' })
    }
    if (copy.ended || copy.full || quota(copy) < bytes) {
      release()
      req.resume()
      return plain(res, 507, `Your copy holds as much as a demo copy may (${config.storage} MB). Reset now for a fresh one.`)
    }
    // Counted against the quota from now on: in flight, then landed until
    // a reading begun after it ended takes it in.
    copy.flying += bytes
    res.on('close', () => {
      copy.flying -= bytes
      copy.landed.push({ at: Date.now(), bytes })
      release()
    })
  }
  const headers = { ...req.headers, cookie: withoutOurs(req.headers.cookie) }
  if (!headers.cookie) {
    delete headers.cookie
  }
  delete headers['x-forwarded-for']
  // Which browser this is, to the room's server alone: a one-way hash of
  // its cookie, which member leases are bound to
  // (`apps/org/ts/src/lib/server/leases.ts`), never the cookie itself.
  headers['x-cella-browser'] = createHash('sha256').update(cookie).digest('hex')
  const upstream = http.request({ socketPath: socketOf(copy.name), path: req.url, method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers)
    up.pipe(res)
  })
  let cut = false
  upstream.on('error', () => {
    if (cut) {
      return
    }
    if (!res.headersSent) {
      plain(res, 502, 'Your copy did not answer; reload the page.')
    } else {
      res.destroy()
    }
  })
  // A body sent with no length is counted as it passes.
  let sent = 0
  req.on('data', (chunk) => {
    sent += chunk.length
    if (sent > limit && !cut) {
      cut = true
      upstream.destroy()
      if (!res.headersSent) {
        plain(res, 413, `A demo takes files up to ${config.upload} MB.`, { connection: 'close' })
      }
      req.unpipe(upstream)
      req.resume()
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
  log(`on http://${config.host}:${config.port}, ${config.cap} copies of ${template} at most, each ending after ${config.idle} s idle or ${config.lifetime} s old`)
})

async function stop() {
  front.close()
  await Promise.all([...rooms()].map((c) => end(c, 'the front stopped')))
  await Promise.all([...ending].map((c) => c.gone))
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
