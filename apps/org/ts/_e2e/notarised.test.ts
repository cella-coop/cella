// The notary unavoidable, end to end on a seeded Lanterne: a write's state
// lands only inside a transaction `cella.begin` opened and `cella.submit`
// settled. The seed founded Lanterne as the log's first entry, and
// every table a feat or a graft made is registered. A psql insert, as the
// app or as a superuser, is refused; a handler that skips submit, or rolls
// its verdict back to a savepoint, commits nothing; a verdict settles only
// the write begun; and only a superuser unbinds. Run by `cella test e2e
// notarised`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { record } from '@cella/org-import/api'
import { found } from '@cella/org-graft-circle-membership-motion/api'
import type { Db, Deps } from '@cella/org-db'
import { sign } from './lanterne.ts'

const su = new pg.Client()
const app = new pg.Client({ user: 'cella_app' })
const camille = 'camille@lanterne.example'
const as = (db: Db = app): Deps => ({ db, actor: camille, sign: sign(camille) })

const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const clients = async () => Number((await one<{ n: string }>('SELECT count(*) AS n FROM client.client')).n)
const runs = async () => Number((await one<{ n: string }>('SELECT count(*) AS n FROM import.run')).n)

// A write by hand, as a handler makes one: the run it records, its signed
// request and its payload, for `import:run:record`.
async function recording(db: pg.Client) {
  const op = 'import:run:record'
  const request = { kind: 'members', name: 'by-hand.csv', dry: true, lines: 0 }
  const proof = await sign(camille)(op, request)
  await db.query(`SELECT set_config('cella.actor', $1, true), set_config('cella.writing', 'on', true)`, [camille])
  await db.query(`SELECT cella.begin($1, $2, decode($3, 'hex'))`, [op, camille, proof.device])
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO import.run (kind, name, actor, day, dry, settled, refused, lines)
     VALUES ('members', 'by-hand.csv', $1, cella.verdict_date(), true, 0, 0, '[]') RETURNING id`,
    [camille],
  )
  const payload = { run: rows[0].id, kind: 'members', dry: true, settled: 0, refused: 0 }
  return { submit: () => db.query('SELECT cella.submit($1, $2, $3, $4)', [op, payload, camille, { request, ...proof }]) }
}

before(async () => {
  await su.connect()
  await app.connect()
})

after(async () => {
  await app.end()
  await su.end()
})

test('the seed founds Lanterne as the log\'s first entry, and every table a feat or a graft made is registered', async () => {
  assert.equal(await head(), 1)
  const first = await one<{ op: string; actor: string }>('SELECT op, actor FROM cella.log WHERE n = 1')
  assert.deepEqual(first, { op: 'circle-membership-motion:scope:found', actor: camille })
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
  const tables = await one<{ made: string; registered: string; triggered: string }>(
    `SELECT count(*) AS made,
            count(*) FILTER (WHERE EXISTS (SELECT FROM cella.state s WHERE s.schema = n.nspname AND s.tab = c.relname)) AS registered,
            count(*) FILTER (WHERE EXISTS (SELECT FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'notarised')
                               AND EXISTS (SELECT FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname = 'notarised_truncate')) AS triggered
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('cella', 'vault', 'migration', 'public', 'information_schema')
       AND n.nspname NOT LIKE 'pg\\_%'`,
  )
  assert.ok(Number(tables.made) > 50, `${tables.made} tables`)
  assert.deepEqual(tables, { made: tables.made, registered: tables.made, triggered: tables.made })
  const again = await found({ form: 'scop-sarl-fr', from: 'again', load: async () => ({}) }, as())
  assert.equal(again.state, 'refused')
  assert.match((again as { reason: string }).reason, /a co-op is founded once, as its log's first entry; the log holds 1 already/)
})

test('a psql write is refused, as the app or as a superuser', async () => {
  for (const [db, sql] of [
    [su, `INSERT INTO client.client (id, kind, name) VALUES ('cl-forged', 'company', 'Forged')`],
    [su, `UPDATE client.client SET note = note || '.'`],
    [su, `DELETE FROM document_membership.reading`],
    [su, 'TRUNCATE timesheet.entry CASCADE'],
    [app, `INSERT INTO import.run (kind, name, actor, day, dry, settled, refused, lines) VALUES ('members', 'x.csv', '${camille}', '2026-10-25', true, 0, 0, '[]')`],
  ] as const) {
    await assert.rejects(db.query(sql), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', `${sql}: ${e.message}`)
      assert.match(e.message, /is written outside a write: state changes only in a transaction cella.begin opens and cella.submit settles/)
      return true
    })
  }
  assert.equal(await clients(), 9)
})

test('a handler that skips submit commits nothing', async () => {
  const before = { head: await head(), runs: await runs() }
  // The handler's connection, minus its submit: the state is written, and
  // the transaction is asked to commit with no verdict.
  const db: Db = app
  const skipping: Db = {
    query: <R>(text: string, values?: unknown[]) =>
      text.includes('cella.submit') ? Promise.resolve({ rows: [{ verdict: '0' } as R], rowCount: 1 }) : db.query<R>(text, values),
  }
  const out = await record({ kind: 'members', name: 'skipped.csv', dry: true, lines: [] }, as(skipping))
  assert.equal(out.state, 'refused')
  assert.match((out as { reason: string }).reason, /import:run:record by camille@lanterne.example was never submitted: a write's state commits only with its verdict/)
  assert.deepEqual({ head: await head(), runs: await runs() }, before)
  const made = await record({ kind: 'members', name: 'made.csv', dry: true, lines: [] }, as())
  assert.equal(made.state, 'settled', made.state === 'refused' ? made.reason : '')
  assert.deepEqual({ head: await head(), runs: await runs() }, { head: before.head + 1, runs: before.runs + 1 })
})

test('a verdict rolled back to a savepoint commits nothing', async () => {
  const before = { head: await head(), runs: await runs() }
  await app.query('BEGIN')
  const w = await recording(app)
  await app.query('SAVEPOINT verdict')
  await w.submit()
  await app.query('ROLLBACK TO SAVEPOINT verdict')
  await assert.rejects(app.query('COMMIT'), /was never submitted/)
  assert.deepEqual({ head: await head(), runs: await runs() }, before)
  // Released, the savepoint keeps it.
  await app.query('BEGIN')
  const kept = await recording(app)
  await app.query('SAVEPOINT verdict')
  await kept.submit()
  await app.query('RELEASE SAVEPOINT verdict')
  await app.query('COMMIT')
  assert.deepEqual({ head: await head(), runs: await runs() }, { head: before.head + 1, runs: before.runs + 1 })
})

test('a verdict settles only the write begun, and one write is one transaction', async () => {
  const proof = await sign(camille)('import:run:record', {})
  const refused = async (sql: string, values: unknown[], why: RegExp) => {
    await app.query('BEGIN')
    try {
      await assert.rejects(app.query(sql, values), why)
    } finally {
      await app.query('ROLLBACK')
    }
  }
  const submit = `SELECT cella.submit('import:run:record', '{}', $1, $2)`
  await refused(submit, [camille, { request: {}, ...proof }], /import:run:record was not begun: a write opens with cella.begin/)
  await app.query('BEGIN')
  try {
    await app.query(`SELECT cella.begin('client:client:add', $1, decode($2, 'hex'))`, [camille, proof.device])
    await assert.rejects(app.query(submit, [camille, { request: {}, ...proof }]), /import:run:record by camille@lanterne.example is not the write this transaction began, client:client:add by camille/)
  } finally {
    await app.query('ROLLBACK')
  }
  await app.query('BEGIN')
  try {
    await app.query(`SELECT cella.begin('client:client:add', $1, decode($2, 'hex'))`, [camille, proof.device])
    await assert.rejects(
      app.query(`SELECT cella.begin('client:client:add', $1, decode($2, 'hex'))`, [camille, proof.device]),
      /opened client:client:add already: one write, one transaction/,
    )
  } finally {
    await app.query('ROLLBACK')
  }
})

test('only a superuser unbinds', async () => {
  await assert.rejects(app.query('SET cella.unbound = on'), /permission denied to set parameter "cella.unbound"/)
  await su.query('BEGIN')
  await su.query('SET LOCAL cella.unbound = on')
  await su.query(`INSERT INTO client.client (id, kind, name) VALUES ('cl-unbound', 'company', 'Unbound')`)
  await su.query('ROLLBACK')
  assert.equal(await clients(), 9)
})
