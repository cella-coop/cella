// pruned: serves the org app of core alone, as tools/prune.mjs left it
// and `cella check pruned` built it, on a database its own migrate made
// with core's SQL alone, and signs in to it (architecture.md, "Removing a
// feat"). A scope of core alone has no founding, which is a graft's write,
// so one person and their device are enrolled below the notary, as a
// slice's tests write the rows they need: the root circle, the person,
// and their TEST-ONLY fixture device. Then the built server starts in dev
// mode, the device answers its challenge (`/session`), and the session's
// first page, the person's Inbox, must answer, as every route of core
// must that a member lands on: a registration, a required effect or a
// read that only a feat makes fails it here.
//
// It connects by the PG* variables, as a superuser, to the database
// `cella test pruned` migrated; the server reads it as the app role.
//
// node tools/pruned.mjs <tree>

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

const [tree] = process.argv.slice(2)
if (!tree) {
  console.error('usage: node tools/pruned.mjs <tree>')
  process.exit(2)
}

const { fixture, open } = await import(pathToFileURL(join(tree, 'apps/org/core/sign/ts/src/index.ts')).href)

const scope = 'pruned.example'
const person = { address: 'ada@pruned.example', name: 'Ada Pruned', label: 'laptop' }
const device = await fixture(person.address, person.label)

const db = new pg.Client()
await db.connect()
await db.query(`ALTER DATABASE ${db.escapeIdentifier(db.database)} SET cella.scope = ${db.escapeLiteral(scope)}`)
await db.query('BEGIN')
await db.query('SET LOCAL cella.unbound = on')
await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'General assembly', true)`)
await db.query('INSERT INTO person.person (circle, address, name) VALUES ($1, $2, $3)', ['ag', person.address, person.name])
await db.query(`INSERT INTO person.device (circle, key, address, label, enrolled) VALUES ('ag', decode($1, 'hex'), $2, $3, current_date)`, [
  device.key,
  person.address,
  person.label,
])
await db.query('COMMIT')
await db.end()

const free = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port
      s.close(() => resolve(port))
    })
  })

const port = await free()
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, PORT: String(port), HOST: '127.0.0.1', PROTOCOL_HEADER: 'x-forwarded-proto', CELLA_DEV: '1' }
delete env.DATABASE_URL
const server = spawn(process.execPath, [join(tree, 'apps/org/ts/build/index.js')], { env, stdio: ['ignore', 'ignore', 'pipe'] })
let said = ''
server.stderr.on('data', (d) => (said += d.toString()))

const fail = (why) => {
  console.error(why)
  if (said) {
    console.error(said)
  }
  server.kill('SIGKILL')
  process.exit(1)
}

try {
  let up = false
  for (let i = 0; i < 100 && !up; i++) {
    up = await fetch(`${base}/session`).then(
      () => true,
      () => new Promise((r) => setTimeout(() => r(false), 100)),
    )
  }
  if (!up) {
    fail('the pruned server never answered')
  }
  const { challenge, scope: named } = await (await fetch(`${base}/session`)).json()
  if (named !== scope) {
    fail(`the pruned server names the scope ${named}, not ${scope}`)
  }
  const sig = await open(scope, person.address, device, challenge)
  const opened = await fetch(`${base}/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: person.address, device: device.key, challenge, sig }),
  })
  if (!opened.ok) {
    fail(`the sign-in was refused, ${opened.status}: ${(await opened.json().catch(() => ({}))).reason ?? ''}`)
  }
  const cookie = (opened.headers.get('set-cookie') ?? '').split(';')[0]
  const landed = await fetch(`${base}/`, { headers: { cookie }, redirect: 'manual' })
  const to = landed.headers.get('location') ?? ''
  if (landed.status < 300 || landed.status >= 400 || !to.endsWith('/inbox')) {
    fail(`signed in, / answered ${landed.status}${to ? ` to ${to}` : ''}, not the Inbox`)
  }
  // Each page as a browser asks for it; a collection's address answers
  // JSON counts to anything else.
  for (const page of ['/inbox', '/people', '/circles']) {
    const read = await fetch(`${base}${page}`, { headers: { cookie, accept: 'text/html' }, redirect: 'manual' })
    const text = await read.text()
    if (read.status !== 200 || !text.includes(person.name)) {
      fail(`signed in, ${page} answered ${read.status}${read.status === 200 ? ` without ${person.name}` : ''}`)
    }
  }
  console.log(`signed in as ${person.address} on core alone; /inbox, /people and /circles answer`)
} finally {
  server.kill('SIGKILL')
}
