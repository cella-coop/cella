// The restore rehearsal, end to end on a seeded Lanterne: members write,
// personal data among it, and `cella backup` backs the scope up; then a
// new host, a cluster of its own whose key files do not exist yet, takes
// it with `cella restore`. The key files are written where it reads them,
// the log verifies at the backup's head, every entry opens from the vault,
// every table holds what it held, and the next write continues the chain
// under the same key. A backup during which the notary's key path moves
// refuses, and one taken in the middle of a vault rotation holds both
// vault keys and restores with every entry opening. Run by `cella test e2e
// restore`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'
import { cella, cluster, started, type Cluster } from './cluster.ts'

const su = new pg.Client()
let app: pg.Client
let host: Cluster
const scratch = mkdtempSync(join(tmpdir(), 'cella-backup-'))
const backup = join(scratch, 'lanterne')

const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'

const as = (db: pg.Client, actor: string): Deps => ({ db, actor, sign: sign(actor) })
const one = async <R>(c: pg.Client, sql: string, values: unknown[] = []) => (await c.query(sql, values)).rows[0] as R
const settled = (out: { state: string; entry?: number; reason?: string }) => {
  assert.equal(out.state, 'settled', out.reason)
  return out.entry as number
}

// Every table's row count, by schema and name.
async function counts(c: pg.Client) {
  const tables = (
    await c.query<{ t: string }>(
      `SELECT format('%I.%I', n.nspname, c.relname) AS t FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY 1`,
    )
  ).rows.map((r) => r.t)
  const out: Record<string, number> = {}
  for (const t of tables) {
    out[t] = Number((await one<{ n: string }>(c, `SELECT count(*) AS n FROM ${t}`)).n)
  }
  return out
}

let written = 0

before(async () => {
  await su.connect()
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '2026-10-24'`)
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
  host = await cluster()
})

after(async () => {
  await app.end()
  await su.end()
  host.stop()
  rmSync(scratch, { recursive: true, force: true })
})

test('members write, personal data among it, and the scope is backed up whole, its keys with it', async () => {
  settled(await profile({ person: hugo, email: 'hugo@moreau.example', phone: '+33 7 00 00 00 02' }, as(app, hugo)))
  written = settled(await profile({ person: julien, email: 'julien@petit.example' }, as(app, julien)))
  assert.equal((await one<{ v: boolean }>(su, 'SELECT cella.verify_log() AS v')).v, true)

  const said = cella(['backup', backup], { CELLA_DB: su.database ?? '' })
  assert.match(said, new RegExp(`backed up ${su.database} at entry ${written}`))
  for (const f of ['db.dump', 'notary.key', 'vault.key', 'manifest']) {
    assert.ok(existsSync(join(backup, f)), f)
  }
  const manifest = readFileSync(join(backup, 'manifest'), 'utf8')
  assert.match(manifest, /^version 0\.6\.0$/m)
  assert.match(manifest, /^setting - cella\.scope=lanterne\.example$/m)
  assert.match(manifest, new RegExp(`^head ${written} [0-9a-f]{64}$`, 'm'))
  const keys = await one<{ notary: string; vault: string }>(
    su,
    `SELECT current_setting('cella.key_file') AS notary, current_setting('cella.vault_key_file') AS vault`,
  )
  assert.deepEqual(readFileSync(join(backup, 'notary.key')), readFileSync(keys.notary))
  assert.deepEqual(readFileSync(join(backup, 'vault.key')), readFileSync(keys.vault))
  assert.equal(existsSync(join(backup, 'vault.previous.key')), false)
  assert.throws(() => cella(['backup', backup], { CELLA_DB: su.database ?? '' }), /a backup goes to a new directory/)
})

test('a new host restores it: its key files written, the log verified at the head, every entry opened, every table whole', async () => {
  const pgsu = await host.client('postgres')
  await pgsu.query('CREATE DATABASE lanterne')
  await pgsu.end()
  assert.equal(existsSync(host.keys.notary), false)

  const said = cella(['restore', backup, '--url', host.url('lanterne')])
  assert.match(said, new RegExp(`the log verifies, ${written} entries, entry ${written} as backed up; every entry opens`))
  assert.deepEqual(readFileSync(host.keys.notary), readFileSync(join(backup, 'notary.key')))
  assert.deepEqual(readFileSync(host.keys.vault), readFileSync(join(backup, 'vault.key')))

  const restored = await host.client('lanterne')
  assert.deepEqual(await counts(restored), await counts(su))
  const scope = await one<{ s: string }>(restored, `SELECT current_setting('cella.scope') AS s`)
  assert.equal(scope.s, 'lanterne.example')
  const opened = async (c: pg.Client) => (await one<{ o: unknown }>(c, 'SELECT cella.opened($1) AS o', [written])).o
  assert.deepEqual(await opened(restored), await opened(su))
  assert.match(JSON.stringify(await opened(restored)), /julien@petit\.example/)
  // What each member signed is kept through it: every receipt's salt.
  const salts = async (c: pg.Client) => (await one<{ s: string }>(c, 'SELECT string_agg(salt, \',\' ORDER BY n) AS s FROM cella.receipt')).s
  assert.equal((await salts(restored)).split(',').length, written)
  assert.equal(await salts(restored), await salts(su))
  await restored.end()

  assert.throws(() => cella(['restore', backup, '--url', host.url('lanterne')]), /already holds a scope/)
})

test('the restored scope takes the next write, chained to the last one under the same key', async () => {
  const restored = await host.client('lanterne', 'cella_app')
  const next = settled(await profile({ person: hugo, phone: '+33 7 00 00 00 03' }, as(restored, hugo)))
  assert.equal(next, written + 1)
  await restored.end()
  const check = await host.client('lanterne')
  assert.equal((await one<{ v: boolean }>(check, 'SELECT cella.verify_log() AS v')).v, true)
  const signers = (await check.query<{ id: number; since: string }>('SELECT id, since FROM cella.signer')).rows
  assert.deepEqual(signers.map((s) => [s.id, Number(s.since)]), [[1, 1]])
  await check.end()
})

test('a backup during which the notary key path moves refuses, and leaves no directory', async () => {
  const during = join(scratch, 'during')
  // A table locked whole holds pg_dump at its start, after the backup has
  // read its manifest and its keys, while the key path moves.
  const lock = await host.client('lanterne')
  const watch = await host.client('lanterne')
  let ran!: ReturnType<typeof started>
  try {
    await lock.query('BEGIN')
    await lock.query('LOCK TABLE cella.receipt IN ACCESS EXCLUSIVE MODE')
    ran = started(['backup', during, '--url', host.url('lanterne')])
    for (let waited = 0; ; waited += 100) {
      const dumping = await one<{ n: string }>(
        watch,
        `SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'pg_dump' AND wait_event_type = 'Lock'`,
      )
      if (Number(dumping.n) > 0) break
      assert.ok(waited < 30000, 'pg_dump never waited on the lock')
      await new Promise((r) => setTimeout(r, 100))
    }
    await host.set('cella.key_file', join(host.dir, 'keys/notary.next.key'))
  } finally {
    await lock.query('COMMIT')
    await lock.end()
    await watch.end()
  }
  const { code, err } = await ran
  await host.set('cella.key_file', null)
  assert.notEqual(code, 0)
  assert.match(err, /cella\.key_file moved from .* while the backup ran: a rotation is under way/)
  assert.equal(existsSync(during), false)
})

test('a backup taken between a vault rotation\'s steps 2 and 3 holds both vault keys, and its restore opens every entry', async () => {
  const next = join(host.dir, 'keys/vault.next.key')
  cella(['key', 'init', '--vault', next])
  await host.set('cella.vault_key_previous', host.keys.vault)
  await host.set('cella.vault_key_file', next)

  const rotating = join(scratch, 'rotating')
  const said = cella(['backup', rotating, '--url', host.url('lanterne')])
  assert.match(said, new RegExp(`at entry ${written + 1} .*the previous vault key`))
  assert.deepEqual(readFileSync(join(rotating, 'vault.key')), readFileSync(next))
  assert.deepEqual(readFileSync(join(rotating, 'vault.previous.key')), readFileSync(host.keys.vault))

  // A third host, whose key files do not exist yet, restores it once it
  // names where the previous vault key goes.
  const third = await cluster()
  try {
    const pgsu = await third.client('postgres')
    await pgsu.query('CREATE DATABASE lanterne')
    await pgsu.end()
    assert.throws(() => cella(['restore', rotating, '--url', third.url('lanterne')]), /sets no cella\.vault_key_previous/)
    const previous = join(third.dir, 'keys/vault.previous.key')
    await third.set('cella.vault_key_previous', previous)
    const restored = cella(['restore', rotating, '--url', third.url('lanterne')])
    assert.match(restored, new RegExp(`${written + 1} entries, entry ${written + 1} as backed up; every entry opens`))
    assert.deepEqual(readFileSync(third.keys.vault), readFileSync(next))
    assert.deepEqual(readFileSync(previous), readFileSync(host.keys.vault))
    const c = await third.client('lanterne')
    assert.match(JSON.stringify((await one<{ o: unknown }>(c, 'SELECT cella.opened($1) AS o', [written])).o), /julien@petit\.example/)
    await c.end()
  } finally {
    third.stop()
  }
})
