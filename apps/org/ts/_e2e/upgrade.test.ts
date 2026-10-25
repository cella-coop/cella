// The upgrade rehearsal: a database a 0.1.0-alpha notary kept, Lanterne
// after the privacy scenario and a profile, 30 entries (`upgrade/`: its
// dump and the TEST-ONLY key that signed it), is loaded on a new host that
// runs today's library. `cella migrate` updates the extension in place and
// moves the applied set to ids; the log verifies under the key that signed
// it, kept now as signer 1; the vault's keys, sealed under the notary's
// seed before the vault had a key of its own, move to the vault's key with
// `cella vault rewrap`; the next write continues the chain. Then both keys
// rotate: the log verifies once the old notary key is gone, which never
// signs again. Run by `cella test e2e upgrade`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import pg from 'pg'
import { profile } from '@cella/org-person/api'
import type { Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'
import { cella, cluster, roles, type Cluster } from './cluster.ts'

const old = new URL('./upgrade/', import.meta.url).pathname
let host: Cluster
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
// Hugo's profile, the dump's last entry, holds his address in the vault.
const HUGO = 30

const one = async <R>(sql: string, values: unknown[] = []) => {
  const c = await host.client('lanterne')
  try {
    return (await c.query(sql, values)).rows[0] as R
  } finally {
    await c.end()
  }
}
const verifies = async () => (await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v
const opened = async (n: number) => JSON.stringify((await one<{ o: unknown }>('SELECT cella.opened($1) AS o', [n])).o)

async function write(actor: string, input: Parameters<typeof profile>[0]) {
  const app = await host.client('lanterne', 'cella_app')
  try {
    const out = await profile(input, { db: app, actor, sign: sign(actor) } satisfies Deps)
    assert.equal(out.state, 'settled', out.state === 'refused' ? out.reason : '')
    return (out as { entry: number }).entry
  } finally {
    await app.end()
  }
}

before(async () => {
  host = await cluster()
  copyFileSync(join(old, 'notary.key'), host.keys.notary)
  writeFileSync(host.keys.vault, randomBytes(32), { mode: 0o600 })
  const su = await host.client('postgres')
  await su.query(roles)
  await su.query('CREATE DATABASE lanterne')
  await su.query(`ALTER DATABASE lanterne SET cella.scope = 'lanterne.example'`)
  await su.query(`ALTER ROLE cella_app IN DATABASE lanterne SET cella.clock = '2026-10-24'`)
  await su.end()
  // A 0.1.0-alpha install makes the head row its dump holds too, so the
  // dump only loads with that row cleared first; 0.2.0 leaves the head to
  // the first write, and its dumps restore.
  const dump = gunzipSync(readFileSync(join(old, '0.1.0-alpha.sql.gz'))).toString().replace('COPY cella.head ', 'DELETE FROM cella.head;\nCOPY cella.head ')
  execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', host.url('lanterne')], { input: dump, stdio: ['pipe', 'ignore', 'pipe'] })
})

after(() => host.stop())

test('a 0.1.0-alpha database migrates in place: the extension updated, the applied set keyed by id, the log kept', async () => {
  assert.equal((await one<{ v: string }>(`SELECT extversion AS v FROM pg_extension WHERE extname = 'cella'`)).v, '0.1.0-alpha')
  const before = await one<{ n: string; hash: string }>(`SELECT n, encode(hash, 'hex') AS hash FROM cella.head`)
  assert.equal(Number(before.n), HUGO)

  cella(['migrate', '--url', host.url('lanterne')])

  assert.equal((await one<{ v: string }>(`SELECT extversion AS v FROM pg_extension WHERE extname = 'cella'`)).v, '0.4.0')
  // Every table it held is a state table now, the notary's trigger on it.
  assert.ok(Number((await one<{ n: string }>('SELECT count(*) AS n FROM cella.state')).n) > 50)
  assert.deepEqual(await one(`SELECT n::text, encode(hash, 'hex') AS hash FROM cella.head`), before)
  const ids = await one<{ n: string; paths: string }>(
    `SELECT count(*) AS n, count(*) FILTER (WHERE id LIKE 'apps/%') AS paths FROM migration.applied WHERE id LIKE 'org:%' OR id LIKE 'apps/%'`,
  )
  assert.equal(ids.paths, '0')
  assert.ok(Number(ids.n) > 170)
  assert.ok(await one(`SELECT FROM migration.applied WHERE id = 'org:core/notary/005-signers.sql'`))
  assert.ok(await one(`SELECT FROM migration.applied WHERE id = 'org:core/notary/006-salts.sql'`))
})

test('the log verifies under the key that signed it, kept as signer 1 and named by every entry', async () => {
  const pub = execFileSync('psql', ['-X', '-t', '-A', '-d', host.url('lanterne'), '-c', `SELECT encode(cella.notary_key(), 'hex')`], { encoding: 'utf8' }).trim()
  const signers = await one<{ list: string }>(`SELECT string_agg(id || ':' || encode(public, 'hex') || ':' || since, ',') AS list FROM cella.signer`)
  assert.equal(signers.list, `1:${pub}:1`)
  assert.deepEqual(await one(`SELECT count(*)::int AS n FROM cella.log WHERE key = 1`), { n: HUGO })
  assert.equal(await verifies(), true)
})

test("the vault's keys, sealed under the notary's seed, move to the vault's own key", async () => {
  await assert.rejects(opened(HUGO), /opens under neither cella.vault_key_file nor cella.vault_key_previous/)
  await host.set('cella.vault_key_previous', host.keys.notary)
  assert.match(await opened(HUGO), /hugo@moreau\.example/)
  assert.match(cella(['vault', 'rewrap', '--url', host.url('lanterne')]), /rewrapped: 1 of 1 vault keys moved/)
  await host.set('cella.vault_key_previous', null)
  assert.match(await opened(HUGO), /hugo@moreau\.example/)
  assert.match(cella(['vault', 'rewrap', '--url', host.url('lanterne')]), /rewrapped: 0 of 1/)
})

test('the next write continues the chain under signer 1', async () => {
  assert.equal(await write(julien, { person: julien, email: 'julien@petit.example' }), HUGO + 1)
  assert.deepEqual(await one(`SELECT key FROM cella.log WHERE n = $1`, [HUGO + 1]), { key: 1 })
  assert.equal(await verifies(), true)
  // Receipts from before 0.3.0 kept no salt; the new one keeps its own.
  assert.deepEqual(
    await one(`SELECT count(*) FILTER (WHERE salt IS NULL)::int AS before, count(*) FILTER (WHERE salt IS NOT NULL)::int AS since FROM cella.receipt`),
    { before: HUGO, since: 1 },
  )
})

test('a rotated notary key signs from its first entry; the log verifies once the old key is gone, and the old key never signs again', async () => {
  const retired = join(host.dir, 'keys/retired.key')
  copyFileSync(host.keys.notary, retired)
  rmSync(host.keys.notary)
  cella(['key', 'init', host.keys.notary])
  const n = await write(hugo, { person: hugo, phone: '+33 7 00 00 00 04' })
  assert.deepEqual(await one(`SELECT id, since::int FROM cella.signer WHERE id = 2`), { id: 2, since: n })
  assert.deepEqual(await one(`SELECT key FROM cella.log WHERE n = $1`, [n]), { key: 2 })
  assert.equal(await verifies(), true)

  // Signer 1's entries verify from the stored key, the file gone.
  rmSync(retired)
  assert.equal(await verifies(), true)

  // Signer 2's key put aside for signer 1's again: refused.
  copyFileSync(host.keys.notary, retired)
  writeFileSync(host.keys.notary, readFileSync(join(old, 'notary.key')))
  await host.set('cella.key_file', host.keys.notary)
  const app = await host.client('lanterne', 'cella_app')
  await assert.rejects(profile({ person: julien, phone: '+33 7 00 00 00 05' }, { db: app, actor: julien, sign: sign(julien) }), /a retired key never signs again/)
  await app.end()
  writeFileSync(host.keys.notary, readFileSync(retired))
})

test("a rotated vault key: the keys move to it, and the vault opens with the old file gone", async () => {
  const next = join(host.dir, 'keys/vault-2.key')
  cella(['key', 'init', '--vault', next])
  await host.set('cella.vault_key_previous', host.keys.vault)
  await host.set('cella.vault_key_file', next)
  assert.match(cella(['vault', 'rewrap', '--url', host.url('lanterne')]), /rewrapped: 2 of 2 vault keys moved/)
  await host.set('cella.vault_key_previous', null)
  rmSync(host.keys.vault)
  assert.match(await opened(HUGO), /hugo@moreau\.example/)
  assert.match(await opened(HUGO + 1), /julien@petit\.example/)
})
