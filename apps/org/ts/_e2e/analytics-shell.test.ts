// The analytics shell and its port on a seeded Lanterne: `cella analytics`
// starts a DuckDB server on the test database, read-only as
// cella_analytics; the port's catalog is the views the slices publish; a
// report joins them in the shell and reconciles with what the slices
// say, stamped with the log's head on the snapshot it read, which a write
// landing meanwhile does not move; and the port refuses every report
// that reads past the catalog, before the shell sees it. Run by `cella
// test` on a fresh database.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { DuckDBInstance } from '@duckdb/node-api'
import { check, Invalid, type Analytics, type Catalog, type Report } from '@cella/org-analytics'
import { shell } from '@cella/org-analytics/api'
import { profile } from '@cella/org-person/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { own } from './port.ts'

const repo = new URL('../../../../', import.meta.url).pathname
const bin = process.env.CELLA_BIN ?? 'cella'
const db = process.env.PGDATABASE ?? 'cella_test'
// A port of its own, apart from the dev shell's and the run's others.
const port = own(10)
const url = `quack:localhost:${port}`
const extensions = process.env.CELLA_DUCKDB_EXTENSIONS ?? ''
const cella = (...args: string[]) => spawnSync(bin, [...args, '--port', port], { cwd: repo, encoding: 'utf8' })

const su = new pg.Client()
let app: pg.Client
let analytics: Analytics & { close: () => void }
let catalog: Catalog
const hugo = 'hugo@lanterne.example'
const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })

before(async () => {
  await su.connect()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
  execFileSync(bin, ['analytics', 'stop', '--port', port], { cwd: repo })
  execFileSync(bin, ['analytics', 'start', '--db', db, '--port', port], { cwd: repo })
  const token = readFileSync(join(repo, '.data/analytics', port, 'token'), 'utf8')
  analytics = await shell({ url, token, extensions })
  catalog = await analytics.catalog()
})

after(async () => {
  analytics?.close()
  execFileSync(bin, ['analytics', 'stop', '--port', port], { cwd: repo })
  await app.end()
  await su.end()
})

const rows = async <R>(sql: string) => (await su.query(sql)).rows as R[]

test('cella analytics runs the shell read-only, as cella_analytics, and nothing outside the views', () => {
  const status = cella('analytics', 'status')
  assert.equal(status.status, 0)
  assert.match(status.stdout, new RegExp(`running on ${url}`))
  const who = cella('analytics', 'query', '--json', "SELECT * FROM postgres_query('scope', 'SELECT current_user::text AS role')")
  assert.equal(who.status, 0, who.stderr)
  assert.deepEqual(JSON.parse(who.stdout), [{ role: 'cella_analytics' }])
  const refused: [string, RegExp][] = [
    ['CREATE TABLE scope.project.x (a int)', /read-only/],
    ["SELECT * FROM read_csv('/etc/passwd')", /disabled by configuration/],
    [`ATTACH 'dbname=${db} user=postgres' AS su (TYPE postgres)`, /disabled through configuration/],
    ['SET lock_configuration = false', /locked/],
    ['SELECT count(*) FROM scope.transaction.line', /permission denied/],
    ["SELECT * FROM postgres_query('scope', 'SELECT n FROM cella.log')", /permission denied/],
  ]
  for (const [sql, why] of refused) {
    const r = cella('analytics', 'query', sql)
    assert.notEqual(r.status, 0, sql)
    assert.match(r.stdout + r.stderr, why, sql)
  }
})

test('a running shell is reused on the database it attaches and refused for any other, untouched', () => {
  const pid = () => readFileSync(join(repo, '.data/analytics', port, 'pid'), 'utf8')
  const before = pid()
  const status = cella('analytics', 'status')
  assert.match(status.stdout, new RegExp(`attaching .*dbname=${db} `))
  const again = cella('analytics', 'start', '--db', db)
  assert.equal(again.status, 0, again.stderr)
  assert.match(again.stdout, /runs already/)
  const other = cella('analytics', 'start', '--db', `${db}_other`)
  assert.notEqual(other.status, 0)
  assert.match(other.stderr, new RegExp(`on ${url} .*attaches .*dbname=${db} .*not .*dbname=${db}_other .*analytics stop --port ${port}.*another --port`))
  const elsewhere = cella('analytics', 'start', '--url', 'postgresql://cella_analytics:s3cret@db.example/scope')
  assert.notEqual(elsewhere.status, 0)
  assert.match(elsewhere.stderr, /not postgresql:\/\/cella_analytics@db\.example\/scope/)
  assert.ok(!elsewhere.stderr.includes('s3cret'), 'a refusal never says a password')
  assert.equal(pid(), before)
  assert.equal(cella('analytics', 'status').status, 0)
})

test('the catalog is the views the slices publish, with their plain types and personal columns', async () => {
  const granted = await rows<{ view: string }>(`
    SELECT format('%s.%s', n.nspname, c.relname) AS view FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname <> 'analytics' AND has_table_privilege('cella_analytics', c.oid, 'SELECT')
      AND has_schema_privilege('cella_analytics', n.oid, 'USAGE') AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 1`)
  assert.deepEqual(Object.keys(catalog).sort(), granted.map((g) => g.view))
  assert.ok(Object.keys(catalog).length >= 50)
  assert.deepEqual(catalog['person.people'], { address: { type: 'text', personal: false }, name: { type: 'text', personal: true } })
  assert.equal(catalog['account_transaction.movements'].debit.type, 'bigint')
  assert.ok(!Object.keys(catalog).some((v) => v.startsWith('analytics.')), 'the head stamps a run; no report reads it')
})

test('a report joins slices in the shell and reconciles with the books to the cent, stamped with the head', async () => {
  const [head] = await rows<{ n: string; hash: string }>(`SELECT n::text, encode(hash, 'hex') AS hash FROM cella.head`)
  const books = await analytics.run({
    from: { m: 'account_transaction.movements' },
    measures: { debit: { fn: 'sum', of: 'm.debit' }, credit: { fn: 'sum', of: 'm.credit' }, lines: { fn: 'count' } },
  })
  assert.deepEqual(books.head, { n: Number(head.n), hash: head.hash })
  const [sums] = await rows<{ debit: string; credit: string }>(`SELECT sum(debit)::text AS debit, sum(credit)::text AS credit FROM account_transaction.movements`)
  assert.equal(String(books.rows[0].debit), sums.debit)
  assert.equal(String(books.rows[0].credit), sums.credit)
  assert.equal(books.rows[0].debit, books.rows[0].credit, 'the books balance')

  const time = await analytics.run({
    from: { p: 'project.projects', m: 'project_timesheet.months' },
    join: [['m.project', 'p.id']],
    fields: ['p.title'],
    measures: { minutes: { fn: 'sum', of: 'm.minutes' } },
    where: [{ field: 'p.archived', op: 'null' }],
    order: ['-minutes', 'p.title'],
  })
  const expected = await rows<{ title: string; minutes: string }>(`
    SELECT p.title, sum(m.minutes)::text AS minutes FROM project.projects p JOIN project_timesheet.months m ON m.project = p.id
    WHERE p.archived IS NULL GROUP BY p.title ORDER BY sum(m.minutes) DESC, p.title`)
  assert.ok(expected.length > 0)
  assert.deepEqual(time.rows.map((r) => [r['p.title'], String(r.minutes)]), expected.map((r) => [r.title, r.minutes]))
  assert.equal(time.more, false)

  const two = await analytics.run({ from: { p: 'project.projects' }, fields: ['p.title'], order: ['p.title'], limit: 2 })
  assert.equal(two.rows.length, 2)
  assert.equal(two.more, true)
  // A value is a literal of its column's type, never SQL.
  const odd = await analytics.run({ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.title', op: '=', value: "x' OR '1'='1" }] })
  assert.deepEqual(odd.rows, [])
  const runs = await Promise.all([1, 2, 3, 4, 5].map(() => analytics.run({ from: { p: 'project.projects' }, measures: { n: { fn: 'count' } } })))
  assert.ok(runs.every((r) => r.rows[0].n === runs[0].rows[0].n && r.head.n === Number(head.n)))
})

test('a run reads one snapshot: a write landing meanwhile moves neither its rows nor its head', async () => {
  const instance = await DuckDBInstance.create(':memory:')
  const c = await instance.connect()
  const [{ v, p }] = (await c.runAndReadAll('SELECT version() AS v, (SELECT platform FROM pragma_platform()) AS p')).getRowObjectsJson() as { v: string; p: string }[]
  for (const ext of ['httpfs', 'quack']) {
    await c.run(`LOAD '${join(extensions, v, p, `${ext}.duckdb_extension`)}'`)
  }
  const token = readFileSync(join(repo, '.data/analytics', port, 'token'), 'utf8')
  await c.run(`ATTACH '${url}' AS shell (TYPE quack, TOKEN '${token}', CLIENT_ID '${randomUUID()}')`)
  await c.run('CONNECT shell')
  const read = async () => {
    const [h] = (await c.runAndReadAll('SELECT n FROM scope.analytics.head')).getRowObjectsJson() as { n: string }[]
    const [r] = (await c.runAndReadAll(`SELECT name FROM scope.person.people WHERE address = '${hugo}'`)).getRowObjectsJson() as { name: string }[]
    return { n: Number(h.n), name: r.name }
  }
  await c.run('BEGIN TRANSACTION')
  const before = await read()
  const written = await profile({ person: hugo, name: 'Hugo L. (renamed)' }, as(hugo))
  assert.equal(written.state, 'settled', JSON.stringify(written))
  const [{ n }] = await rows<{ n: string }>('SELECT n::text FROM cella.head')
  assert.equal(Number(n), before.n + 1, 'the write is logged')
  assert.deepEqual(await read(), before, 'the snapshot holds')
  await c.run('COMMIT')
  assert.deepEqual(await read(), { n: before.n + 1, name: 'Hugo L. (renamed)' })
  await c.run('DISCONNECT')
  c.closeSync()
  instance.closeSync()
  const after = await analytics.run({ from: { x: 'person.people' }, fields: ['x.name'], where: [{ field: 'x.address', op: '=', value: hugo }], personal: ['x.name'] })
  assert.equal(after.head.n, before.n + 1)
  assert.deepEqual(after.rows, [{ 'x.name': 'Hugo L. (renamed)' }])
})

test('the port refuses a report that reads past the catalog, with every reason, before the shell sees it', async () => {
  const shown = Object.entries(catalog).flatMap(([view, cols]) => Object.entries(cols).filter(([, c]) => c.type === 'jsonb' || c.type === 'text[]').map(([col]) => [view, col]))[0]
  const bad: [Report, RegExp][] = [
    [{ from: {}, fields: [] }, /at least one view/],
    [{ from: { l: 'transaction.line' }, fields: ['l.amount'] }, /transaction.line is no view the slices publish/],
    [{ from: { h: 'analytics.head' }, fields: ['h.n'] }, /analytics.head is no view/],
    [{ from: { p: 'project.projects' }, fields: ['p.secret'] }, /shares no column secret/],
    [{ from: { p: 'project.projects' }, fields: ['q.title'] }, /no view of the report is named q/],
    [{ from: { p: 'project.projects' }, fields: ['title'] }, /no view of the report is named title/],
    [{ from: { 'p; DROP': 'project.projects' }, fields: ['p; DROP.title'] }, /lowercase letters/],
    [{ from: { p: 'project.projects', m: 'project.milestones' }, fields: ['p.title', 'm.title'] }, /m \(project.milestones\) joins no view before it/],
    [{ from: { p: 'project.projects', m: 'project.milestones' }, join: [['m.due', 'p.budget']], fields: ['p.title'] }, /date and bigint are not one kind/],
    [{ from: { p: 'project.projects', q: 'project.projects' }, join: [['p.id', 'p.id']], fields: ['p.title'] }, /not one with itself/],
    [{ from: { p: 'project.projects' }, measures: { s: { fn: 'sum', of: 'p.title' } } }, /sum of p.title, a text, which is no number/],
    [{ from: { p: 'project.projects' }, measures: { s: { fn: 'median' as 'sum', of: 'p.budget' } } }, /median is no measure/],
    [{ from: { p: 'project.projects' }, measures: { s: { fn: 'avg' } } }, /avg measures a field/],
    [{ from: { p: 'project.projects' }, measures: { 'S"': { fn: 'count' } } }, /a measure's name/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.budget', op: '>', value: '1; DROP TABLE x' }] }, /not a bigint/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.budget', op: '>', value: 1.5 }] }, /not a bigint/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.due', op: '<', value: 'tomorrow' }] }, /not a date/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.title', op: 'like' as '=', value: '%' }] }, /like is no comparison/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.title', op: 'in', value: [] }] }, /a list of 1 to/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.due', op: 'null', value: '2026-01-01' }] }, /takes no value/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], where: [{ field: 'p.title', op: '=', value: 'a\0b' }] }, /not a text/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], order: ['p.budget'] }, /orders by a field it shows/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], limit: 0 }, /limit 0/],
    [{ from: { p: 'project.projects' }, fields: ['p.title'], limit: 10_001 }, /limit 10001/],
    [{ from: { x: 'person.people' }, fields: ['x.name'] }, /x.name is personal/],
    [{ from: { x: 'person.people' }, measures: { n: { fn: 'count', of: 'x.name' } } }, /x.name is personal/],
    [{ from: { x: 'person.people' }, fields: ['x.address'], where: [{ field: 'x.name', op: '=', value: 'Hugo' }] }, /x.name is personal/],
    [{ from: { x: 'person.people' }, fields: ['x.address'], personal: ['x.address'] }, /personal x.address: no personal column/],
  ]
  const flag = Object.entries(catalog).flatMap(([view, cols]) => Object.entries(cols).filter(([, c]) => c.type === 'boolean').map(([col]) => [view, col]))[0]
  assert.ok(flag, 'a view shares a flag')
  bad.push([{ from: { f: flag[0] }, measures: { s: { fn: 'max', of: `f.${flag[1]}` } } }, /has no order/])
  bad.push([{ from: { f: flag[0] }, measures: { n: { fn: 'count' } }, where: [{ field: `f.${flag[1]}`, op: '<', value: true }] }, /a boolean is equal or not/])
  if (shown) {
    const [view, col] = shown
    bad.push([{ from: { a: view }, fields: [`a.${col}`], where: [{ field: `a.${col}`, op: '=', value: '[]' }] }, /only shown, never compared/])
  }
  for (const [report, why] of bad) {
    const reasons = check(report, catalog)
    assert.ok(reasons.some((r) => why.test(r)), `${JSON.stringify(report)}: ${reasons.join('; ') || 'allowed'}`)
    await assert.rejects(analytics.run(report), (e: unknown) => e instanceof Invalid && e.reasons.some((r) => why.test(r)))
  }
  // Every reason at once, not the first alone.
  assert.equal(check({ from: { p: 'project.projects' }, fields: ['p.secret'], limit: 0, order: ['x'] }, catalog).length, 3)
  // What is declared reads.
  assert.deepEqual(check({ from: { x: 'person.people' }, fields: ['x.name'], personal: ['x.name'] }, catalog), [])
})
